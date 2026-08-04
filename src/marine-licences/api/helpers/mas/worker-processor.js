import { config } from '../../../../config.js'
import { parseMessageBody } from '../../../../shared/common/helpers/sqs/parse-message-body.js'
import { isNonEmptyString } from '../../../../shared/helpers/is-non-empty-string.js'
import {
  MARINE_LICENCE_STATUS,
  MAS_EVENT_ACTION
} from '../../../constants/marine-licence.js'
import { deleteMasMessage } from './sqs-client.js'
import { updateRejectedMarineLicence } from './update-rejected-licence.js'
import { updateTransferredMarineLicence } from './update-transferred-licence.js'

const discardMalformedMessage = 'Discarding malformed MAS message'

export const processMasMessage = async (server, message) => {
  const { db, logger } = server
  const { sqsQueueName } = config.get('mas')

  const body = parseMessageBody(message, logger, discardMalformedMessage)

  if (!body) {
    await deleteMasMessage(sqsQueueName, message.ReceiptHandle)
    return
  }

  logger.info(
    {
      event: {
        action: MAS_EVENT_ACTION.MESSAGE_RECEIVED,
        outcome: 'success',
        reference: body.applicationReference
      }
    },
    `Received MAS message for ${body.applicationReference}`
  )

  const { applicationReference, status } = body

  if (!isNonEmptyString(applicationReference)) {
    throw new Error('No Application Reference exists on message')
  }

  if (status === MARINE_LICENCE_STATUS.TRANSFERRED) {
    await updateTransferredMarineLicence(db, logger, {
      body,
      id: message.MessageId
    })
  }

  if (status === MARINE_LICENCE_STATUS.REJECTED) {
    await updateRejectedMarineLicence(db, logger, {
      body,
      id: message.MessageId
    })
  }

  await deleteMasMessage(sqsQueueName, message.ReceiptHandle)
}

export const processMasDlqMessage = async (server, message) => {
  const { logger } = server
  const { sqsDlqName } = config.get('mas')

  const body = parseMessageBody(message, logger, discardMalformedMessage)
  if (body) {
    logger.warn(
      {
        event: {
          action: MAS_EVENT_ACTION.MESSAGE_DEAD_LETTERED,
          outcome: 'failure',
          reference: body.applicationReference
        }
      },
      `MAS message dead-lettered for ${body.applicationReference}`
    )
  }

  await deleteMasMessage(sqsDlqName, message.ReceiptHandle)
}
