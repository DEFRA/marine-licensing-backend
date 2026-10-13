import { config } from '../../../../config.js'
import {
  sendMessage,
  receiveMessages,
  deleteMessage
} from '../../../../shared/common/helpers/sqs/sqs-client.js'
import { DYNAMICS_QUEUE_TYPES } from '../../../../shared/common/constants/request-queue.js'

export const DYNAMICS_RECEIVE_OPTIONS = {
  MaxNumberOfMessages: 10,
  WaitTimeSeconds: 20,
  MessageSystemAttributeNames: ['ApproximateReceiveCount']
}

const queueConfig = () => config.get('dynamics').marineLicences

export const sendDynamicsJob = async ({ applicationReference, action }) =>
  sendMessage(
    queueConfig().sqsQueueName,
    JSON.stringify({
      applicationReference,
      action,
      type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE
    })
  )

export const receiveDynamicsJobs = async () =>
  receiveMessages(queueConfig().sqsQueueName, DYNAMICS_RECEIVE_OPTIONS)

export const receiveDynamicsDlqJobs = async () =>
  receiveMessages(queueConfig().sqsDlqName, DYNAMICS_RECEIVE_OPTIONS)

export const deleteDynamicsJob = async (queueName, receiptHandle) =>
  deleteMessage(queueName, receiptHandle)
