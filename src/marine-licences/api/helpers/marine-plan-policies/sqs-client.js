import { config } from '../../../../config.js'
import {
  sendMessage,
  receiveMessages,
  deleteMessage
} from '../../../../shared/common/helpers/sqs/sqs-client.js'

export { resetSqsClient } from '../../../../shared/common/helpers/sqs/sqs-client.js'

export const MPP_RECEIVE_OPTIONS = {
  MaxNumberOfMessages: 10,
  WaitTimeSeconds: 20,
  MessageSystemAttributeNames: ['ApproximateReceiveCount']
}

export const sendPolicyJob = async ({ licenceId, policyJobId }) => {
  const { sqsQueueName } = config.get('marinePlanPolicies')
  return sendMessage(sqsQueueName, JSON.stringify({ licenceId, policyJobId }))
}

export const receivePolicyJobs = async () =>
  receiveMessages(
    config.get('marinePlanPolicies').sqsQueueName,
    MPP_RECEIVE_OPTIONS
  )

export const receiveDlqJobs = async () =>
  receiveMessages(
    config.get('marinePlanPolicies').sqsDlqName,
    MPP_RECEIVE_OPTIONS
  )

export const deletePolicyJob = async (queueName, receiptHandle) =>
  deleteMessage(queueName, receiptHandle)
