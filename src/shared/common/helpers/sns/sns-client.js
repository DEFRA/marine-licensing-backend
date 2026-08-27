import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { config } from '../../../../config.js'

let snsClientInstance = null

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
}

/**
 * @param {string} topicArn - Full SNS topic ARN
 * @param {string} messageBody - JSON string
 * @param {Record<string, { DataType: string, StringValue: string }>|undefined} messageAttributes
 */
export const publishMessage = async (
  topicArn,
  messageBody,
  messageAttributes
) =>
  getSnsClient().send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: messageBody,
      ...(messageAttributes ? { MessageAttributes: messageAttributes } : {})
    })
  )
