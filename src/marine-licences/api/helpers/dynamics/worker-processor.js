import { config } from '../../../../config.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import {
  DYNAMICS_QUEUE_TYPES,
  DYNAMICS_REQUEST_ACTIONS
} from '../../../../shared/common/constants/request-queue.js'
import { sendToDynamics } from '../../../../shared/common/helpers/dynamics/dynamics-client.js'
import { getDynamicsAccessToken } from '../../../../shared/common/helpers/dynamics/get-access-token.js'
import { structureErrorForECS } from '../../../../shared/common/helpers/logging/logger.js'
import { parseMessageBody } from '../../../../shared/common/helpers/sqs/parse-message-body.js'
import { isNonEmptyString } from '../../../../shared/helpers/is-non-empty-string.js'
import {
  DYNAMICS_OUTBOUND_STATUS,
  MARINE_LICENCE_DYNAMICS_EVENT_ACTION as EVENT_ACTION
} from '../../../constants/marine-licence.js'
import { deleteDynamicsJob } from './sqs-client.js'

const discardMalformedMessage =
  'Discarding malformed marine licence Dynamics message'

const supportedActions = new Set([
  DYNAMICS_REQUEST_ACTIONS.SUBMIT,
  DYNAMICS_REQUEST_ACTIONS.WITHDRAW
])

const parseDynamicsJobBody = (message, logger) =>
  parseMessageBody(message, logger, discardMalformedMessage, (body) => {
    const { applicationReference, action } = body
    if (
      !isNonEmptyString(applicationReference) ||
      !supportedActions.has(action)
    ) {
      throw new Error(
        'applicationReference and a submit or withdraw action are required'
      )
    }
    return { applicationReference, action }
  })

const outboundField = (action) => `dynamicsOutbound.${action}`

const isWithdrawalAwaitingSubmit = (action, outbound) =>
  action === DYNAMICS_REQUEST_ACTIONS.WITHDRAW &&
  outbound.submit !== DYNAMICS_OUTBOUND_STATUS.SENT

const setOutboundStatusUnlessSent = (
  db,
  applicationReference,
  action,
  status
) =>
  db.collection(collectionMarineLicences).updateOne(
    {
      applicationReference,
      [outboundField(action)]: { $ne: DYNAMICS_OUTBOUND_STATUS.SENT }
    },
    { $set: { [outboundField(action)]: status } }
  )

const markSentToDynamics = (db, applicationReference, action) =>
  setOutboundStatusUnlessSent(
    db,
    applicationReference,
    action,
    DYNAMICS_OUTBOUND_STATUS.SENT
  )

const markFailedToSendToDynamics = (db, applicationReference, action) =>
  setOutboundStatusUnlessSent(
    db,
    applicationReference,
    action,
    DYNAMICS_OUTBOUND_STATUS.FAILED
  )

const event = (action, outcome, reference, reason) => ({
  event: { action, outcome, reference, ...(reason ? { reason } : {}) }
})

const sendAndFlag = async (server, { applicationReference, action }) => {
  const { httpTimeoutMs } = config.get('dynamics').marineLicences
  const accessToken = await getDynamicsAccessToken({ timeoutMs: httpTimeoutMs })
  await sendToDynamics(server, accessToken, {
    applicationReferenceNumber: applicationReference,
    action,
    type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE
  })
  await markSentToDynamics(server.db, applicationReference, action)
}

const handleSendFailure = async (server, message, job, error) => {
  const { applicationReference, action } = job
  server.logger.error(
    {
      ...structureErrorForECS(error),
      ...event(
        EVENT_ACTION.SEND_FAILED,
        'failure',
        applicationReference,
        'The queue will retry'
      )
    },
    `Failed to send marine licence ${action} for ${applicationReference} to Dynamics; the queue will retry`
  )

  const receiveCount = Number(message.Attributes?.ApproximateReceiveCount ?? 0)
  const { sqsMaxReceiveCount } = config.get('dynamics').marineLicences
  if (receiveCount >= sqsMaxReceiveCount) {
    await markFailedToSendToDynamics(server.db, applicationReference, action)
    server.logger.warn(
      event(
        EVENT_ACTION.MARKED_FAILED,
        'failure',
        applicationReference,
        'No automatic retry; the licence is marked failed'
      ),
      `Marine licence ${action} for ${applicationReference} marked failed after ${receiveCount} attempts`
    )
  }
}

export const processDynamicsJob = async (server, message) => {
  const { db, logger } = server
  const { sqsQueueName } = config.get('dynamics').marineLicences
  const deleteMessage = () =>
    deleteDynamicsJob(sqsQueueName, message.ReceiptHandle)

  const job = parseDynamicsJobBody(message, logger)
  if (!job) {
    await deleteMessage()
    return
  }
  const { applicationReference, action } = job

  const licence = await db
    .collection(collectionMarineLicences)
    .findOne({ applicationReference }, { projection: { dynamicsOutbound: 1 } })
  if (!licence) {
    logger.warn(
      event(EVENT_ACTION.LICENCE_NOT_FOUND, 'failure', applicationReference),
      `No marine licence found for ${applicationReference}; discarding Dynamics ${action}`
    )
    await deleteMessage()
    return
  }

  const outbound = licence.dynamicsOutbound ?? {}
  if (outbound[action] === DYNAMICS_OUTBOUND_STATUS.SENT) {
    logger.info(
      event(EVENT_ACTION.ALREADY_SENT, 'success', applicationReference),
      `Marine licence ${action} for ${applicationReference} already sent to Dynamics; discarding duplicate`
    )
    await deleteMessage()
    return
  }

  if (isWithdrawalAwaitingSubmit(action, outbound)) {
    logger.info(
      event(
        EVENT_ACTION.AWAITING_SUBMIT,
        'unknown',
        applicationReference,
        'Waiting for the submit to be sent; the queue will retry'
      ),
      `Marine licence withdrawal for ${applicationReference} is waiting for its submit to reach Dynamics`
    )
    return
  }

  try {
    await sendAndFlag(server, job)
  } catch (error) {
    await handleSendFailure(server, message, job, error)
    return
  }

  logger.info(
    event(EVENT_ACTION.SENT, 'success', applicationReference),
    `Marine licence ${action} for ${applicationReference} sent to Dynamics`
  )
  await deleteMessage()
}

export const processDynamicsDlqJob = async (server, message) => {
  const { db, logger } = server
  const { sqsDlqName } = config.get('dynamics').marineLicences

  const job = parseDynamicsJobBody(message, logger)
  if (job) {
    const { applicationReference, action } = job
    const result = await markFailedToSendToDynamics(
      db,
      applicationReference,
      action
    )
    if (result.matchedCount > 0) {
      logger.warn(
        event(
          EVENT_ACTION.MARKED_FAILED,
          'failure',
          applicationReference,
          'No automatic retry; the licence is marked failed'
        ),
        `Marine licence ${action} for ${applicationReference} dead-lettered and marked failed`
      )
    } else {
      logger.info(
        event(
          EVENT_ACTION.DEAD_LETTER_IGNORED,
          'success',
          applicationReference
        ),
        `Ignoring dead-lettered marine licence ${action} for ${applicationReference}: already sent or licence not found`
      )
    }
  }
  await deleteDynamicsJob(sqsDlqName, message.ReceiptHandle)
}
