import { ObjectId } from 'mongodb'
import { config } from '../../../../config.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../../shared/common/helpers/logging/logger.js'
import {
  MARINE_PLAN_POLICY_JOB_STATUS,
  MARINE_PLAN_POLICY_EVENT_ACTION
} from '../../../constants/marine-licence.js'
import { queryArcGISPolicies } from './arcgis-client.js'
import { getPolicyContent } from './policy-content-client.js'
import { deletePolicyJob } from './sqs-client.js'

const parseMessageBody = (message, logger) => {
  try {
    const { licenceId, policyJobId } = JSON.parse(message.Body)
    if (!licenceId || !policyJobId) {
      throw new Error('licenceId and policyJobId are required')
    }
    return { licenceId, policyJobId }
  } catch (error) {
    logger.error(
      structureErrorForECS(error),
      'Discarding malformed policy job message'
    )
    return null
  }
}

const fetchPolicies = async ({ siteDetails, db, logger }) => {
  const policies = await queryArcGISPolicies({ siteDetails, logger })
  return Promise.all(
    policies.map(async (policy) => {
      const content = await getPolicyContent({
        policyCode: policy.policyCode,
        db,
        logger
      })
      return { ...policy, ...content }
    })
  )
}

// Conditional on marinePlanPolicyJobId so a site edit mid-flight is never overwritten
const setJobStatus = ({ collection, _id, policyJobId }, status, extra = {}) =>
  collection.updateOne(
    { _id, marinePlanPolicyJobId: policyJobId },
    { $set: { marinePlanPolicyJob: status, ...extra } }
  )

const logDiscardedJob = (logger, detail) =>
  logger.info(
    {
      event: {
        action: MARINE_PLAN_POLICY_EVENT_ACTION.JOB_STALE
      }
    },
    detail
  )

const computeAndStorePolicies = async (job, licence, db) => {
  const { licenceId, logger } = job
  const marinePlanPolicies = await fetchPolicies({
    siteDetails: licence.siteDetails,
    db,
    logger
  })

  const result = await setJobStatus(job, MARINE_PLAN_POLICY_JOB_STATUS.READY, {
    marinePlanPolicies
  })
  if (result.matchedCount > 0) {
    logger.info(
      {
        event: {
          action: MARINE_PLAN_POLICY_EVENT_ACTION.JOB_COMPLETE,
          outcome: 'success'
        }
      },
      `Policy job complete for licence ${licenceId}: ${marinePlanPolicies.length} applicable policies`
    )
  } else {
    logDiscardedJob(
      logger,
      `Discarding policy job result computed for stale sites on licence ${licenceId}`
    )
  }
}

// Status deliberately stays 'computing' between attempts so the front end
// keeps showing the calculating view; 'failed' is terminal and only set when
// the message dead-letters after the queue's retry budget is spent.
// Message deliberately not deleted — SQS redelivers after the visibility timeout.
const handleJobFailure = (job, error) => {
  job.logger.error(
    structureErrorForECS(error),
    `Policy calculation failed for licence ${job.licenceId}; the queue will retry`
  )
}

// On transient failure the message is left on the queue; the DLQ worker marks it failed after maxReceiveCount is spent.
export const processPolicyJob = async (server, message) => {
  const { db, logger } = server
  const { sqsQueueName } = config.get('marinePlanPolicies')

  const body = parseMessageBody(message, logger)
  if (!body) {
    await deletePolicyJob(sqsQueueName, message.ReceiptHandle)
    return
  }
  const { licenceId, policyJobId } = body
  const job = {
    collection: db.collection(collectionMarineLicences),
    _id: ObjectId.createFromHexString(licenceId),
    licenceId,
    policyJobId,
    logger
  }

  const licence = await job.collection.findOne({ _id: job._id })
  if (!licence || licence.marinePlanPolicyJobId !== policyJobId) {
    logDiscardedJob(
      logger,
      `Discarding stale policy job for licence ${licenceId}`
    )
    await deletePolicyJob(sqsQueueName, message.ReceiptHandle)
    return
  }

  await setJobStatus(job, MARINE_PLAN_POLICY_JOB_STATUS.COMPUTING)

  try {
    await computeAndStorePolicies(job, licence, db)
    await deletePolicyJob(sqsQueueName, message.ReceiptHandle)
  } catch (error) {
    handleJobFailure(job, error)
    const receiveCount = Number(
      message.Attributes?.ApproximateReceiveCount ?? 0
    )
    const { sqsMaxReceiveCount } = config.get('marinePlanPolicies')
    if (receiveCount >= sqsMaxReceiveCount) {
      await setJobStatus(job, MARINE_PLAN_POLICY_JOB_STATUS.FAILED)
      // Message is not deleted — SQS dead-letters it naturally.
      // The DLQ worker will encounter a no-op and clean up.
    }
  }
}

// On the final delivery attempt the main worker already sets 'failed'.
// processDlqJob acts as a safety net for edge cases (e.g. process crash
// before the DB write on the last attempt) and always cleans up the DLQ.
// The per-request policyJobId match ensures a lingering dead-letter never
// overwrites a newer job the user has since re-triggered.
export const processDlqJob = async (server, message) => {
  const { db, logger } = server
  const { sqsDlqName } = config.get('marinePlanPolicies')

  const body = parseMessageBody(message, logger)
  if (body) {
    const { licenceId, policyJobId } = body
    const job = {
      collection: db.collection(collectionMarineLicences),
      _id: ObjectId.createFromHexString(licenceId),
      licenceId,
      policyJobId,
      logger
    }
    const result = await job.collection.updateOne(
      {
        _id: job._id,
        marinePlanPolicyJobId: policyJobId
      },
      { $set: { marinePlanPolicyJob: MARINE_PLAN_POLICY_JOB_STATUS.FAILED } }
    )
    if (result.matchedCount > 0) {
      logger.warn(
        {
          event: {
            action: MARINE_PLAN_POLICY_EVENT_ACTION.JOB_FAILED,
            outcome: 'failure'
          }
        },
        `Policy job dead-lettered and marked failed for licence ${licenceId}`
      )
    } else {
      logDiscardedJob(
        logger,
        `Discarding stale dead-lettered policy job for licence ${licenceId}`
      )
    }
  }
  await deletePolicyJob(sqsDlqName, message.ReceiptHandle)
}
