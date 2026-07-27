import { config } from '../../../../config.js'
import { parseMessageBody } from '../../../../shared/common/helpers/sqs/parse-message-body.js'
import { deleteMasMessage } from './sqs-client.js'

const discardMalformedMessage = 'Discarding malformed MAS message'

export const processMasMessage = async (server, message) => {
  const { logger } = server
  const { sqsQueueName } = config.get('mas')

  const body = parseMessageBody(message, logger, discardMalformedMessage)
  if (body) {
    logger.info({ body }, 'Received MAS message')
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
