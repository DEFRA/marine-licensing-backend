import {
  SNSClient,
  CreateTopicCommand,
  PublishCommand
} from '@aws-sdk/client-sns'
import { config } from '../../../../config.js'

let snsClientInstance = null
const arnCache = new Map()

export const getSnsClient = () => {
  if (!snsClientInstance) {
    const awsConfig = config.get('aws')
    snsClientInstance = new SNSClient({
      region: awsConfig.region,
      endpoint: awsConfig.sns.endpoint
    })
  }
  return snsClientInstance
}

export const resetSnsClient = () => {
  snsClientInstance = null
  arnCache.clear()
}

/**
 * Resolve an SNS topic ARN by name. CreateTopic is idempotent: if the topic
 * already exists, AWS returns its ARN (same role GetQueueUrl plays for SQS).
 */
const resolveTopicArn = async (topicName) => {
  if (arnCache.has(topicName)) {
    return arnCache.get(topicName)
  }

  const { TopicArn } = await getSnsClient().send(
    new CreateTopicCommand({ Name: topicName })
  )

  arnCache.set(topicName, TopicArn)
  return TopicArn
}

/**
 * @param {string} topicName
 * @param {string} messageBody - JSON string
 * @param {Record<string, { DataType: string, StringValue: string }>|undefined} messageAttributes
 */
export const publishMessage = async (
  topicName,
  messageBody,
  messageAttributes
) => {
  const topicArn = await resolveTopicArn(topicName)
  return getSnsClient().send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: messageBody,
      ...(messageAttributes ? { MessageAttributes: messageAttributes } : {})
    })
  )
}
