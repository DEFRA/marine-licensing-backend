import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueUrlCommand
} from '@aws-sdk/client-sqs'
import { config } from '../../../../config.js'

let sqsClientInstance = null
const urlCache = new Map()

export const getSqsClient = () => {
  if (!sqsClientInstance) {
    const awsConfig = config.get('aws')
    sqsClientInstance = new SQSClient({
      region: awsConfig.region,
      endpoint: awsConfig.sqs.endpoint
    })
  }
  return sqsClientInstance
}

export const resetSqsClient = () => {
  sqsClientInstance = null
  urlCache.clear()
}

const resolveQueueUrl = async (queueName) => {
  if (urlCache.has(queueName)) {
    return urlCache.get(queueName)
  }
  const { QueueUrl } = await getSqsClient().send(
    new GetQueueUrlCommand({ QueueName: queueName })
  )
  urlCache.set(queueName, QueueUrl)
  return QueueUrl
}

export const sendMessage = async (queueName, messageBody) => {
  const queueUrl = await resolveQueueUrl(queueName)
  return getSqsClient().send(
    new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: messageBody })
  )
}

export const receiveMessages = async (queueName, options = {}) => {
  const queueUrl = await resolveQueueUrl(queueName)
  const { Messages } = await getSqsClient().send(
    new ReceiveMessageCommand({ QueueUrl: queueUrl, ...options })
  )
  return Messages ?? []
}

export const deleteMessage = async (queueName, receiptHandle) => {
  const queueUrl = await resolveQueueUrl(queueName)
  return getSqsClient().send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle
    })
  )
}
