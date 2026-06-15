import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand
} from '@aws-sdk/client-sqs'
import { config } from '../../../../config.js'

let sqsClientInstance = null

export const getSqsClient = () => {
  if (!sqsClientInstance) {
    const awsConfig = config.get('aws')
    const policiesConfig = config.get('marinePlanPolicies')
    sqsClientInstance = new SQSClient({
      region: awsConfig.region,
      endpoint: policiesConfig.sqsEndpoint
    })
  }
  return sqsClientInstance
}

export const resetSqsClient = () => {
  sqsClientInstance = null
}

export const sendPolicyJob = async ({ licenceId, policyJobId, queuedAt }) => {
  const { sqsQueueUrl } = config.get('marinePlanPolicies')
  return getSqsClient().send(
    new SendMessageCommand({
      QueueUrl: sqsQueueUrl,
      MessageGroupId: licenceId,
      MessageDeduplicationId: policyJobId,
      MessageBody: JSON.stringify({ licenceId, policyJobId, queuedAt })
    })
  )
}

const receiveMessages = async (queueUrl) => {
  const { Messages } = await getSqsClient().send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20
    })
  )
  return Messages ?? []
}

export const receivePolicyJobs = async () =>
  receiveMessages(config.get('marinePlanPolicies').sqsQueueUrl)

export const receiveDlqJobs = async () =>
  receiveMessages(config.get('marinePlanPolicies').sqsDlqUrl)

export const deletePolicyJob = async (queueUrl, receiptHandle) =>
  getSqsClient().send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle
    })
  )
