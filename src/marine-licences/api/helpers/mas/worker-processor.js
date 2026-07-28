import { config } from '../../../../config.js'
import { parseMessageBody } from '../../../../shared/common/helpers/sqs/parse-message-body.js'
import { deleteMasMessage } from './sqs-client.js'
import { updateTransferredMarineLicence } from './update-licence.js'

const discardMalformedMessage = 'Discarding malformed MAS message'

export const processMasMessage = async (server, message) => {
  const { db, logger } = server
  const { sqsQueueName } = config.get('mas')

  const body = parseMessageBody(message, logger, discardMalformedMessage)

  if (!body) {
    await deleteMasMessage(sqsQueueName, message.ReceiptHandle)
    return
  }

  logger.info({ body }, 'Received MAS message')

  const { applicationReference, status } = body

  if (!applicationReference) {
    throw new Error('No Application Reference exists on message')
  }

  if (status === 'transferred') {
    await updateTransferredMarineLicence(db, logger, {
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
    logger.warn({ body }, 'MAS message dead-lettered')
  }

  await deleteMasMessage(sqsDlqName, message.ReceiptHandle)
}
