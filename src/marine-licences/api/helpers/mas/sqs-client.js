import { config } from '../../../../config.js'
import {
  receiveMessages,
  deleteMessage
} from '../../../../shared/common/helpers/sqs/sqs-client.js'

export { resetSqsClient } from '../../../../shared/common/helpers/sqs/sqs-client.js'

export const MAS_RECEIVE_OPTIONS = {
  MaxNumberOfMessages: 10,
  WaitTimeSeconds: 20,
  MessageSystemAttributeNames: ['ApproximateReceiveCount']
}

export const receiveMasMessages = async () =>
  receiveMessages(config.get('mas').sqsQueueName, MAS_RECEIVE_OPTIONS)

export const receiveMasDlqMessages = async () =>
  receiveMessages(config.get('mas').sqsDlqName, MAS_RECEIVE_OPTIONS)

export const deleteMasMessage = async (queueName, receiptHandle) =>
  deleteMessage(queueName, receiptHandle)
