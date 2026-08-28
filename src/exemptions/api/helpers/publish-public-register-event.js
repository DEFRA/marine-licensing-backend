import { config } from '../../../config.js'
import { publishMessage } from '../../../shared/common/helpers/sns/sns-client.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'

export const PUBLIC_REGISTER_APPLICATION_TYPE = 'exemption'
export const PUBLIC_REGISTER_EVENT_TYPE_SUBMITTED = 'submitted'

/**
 * Publish a simple public-register event to SNS when an exemption is submitted
 * with public register consent. Failures are logged and do not fail submission.
 *
 * @param {{
 *   applicationId: string,
 *   applicationReference: string,
 *   logger: { error: Function, info?: Function }
 * }} params
 */
export const publishPublicRegisterSubmittedEvent = async ({
  applicationId,
  applicationReference,
  logger
}) => {
  const topicArn = config.get('publicRegister.snsTopicArn')
  const message = {
    applicationType: PUBLIC_REGISTER_APPLICATION_TYPE,
    eventType: PUBLIC_REGISTER_EVENT_TYPE_SUBMITTED,
    applicationId,
    applicationReference
  }

  try {
    await publishMessage(topicArn, JSON.stringify(message), {
      applicationType: {
        DataType: 'String',
        StringValue: PUBLIC_REGISTER_APPLICATION_TYPE
      },
      eventType: {
        DataType: 'String',
        StringValue: PUBLIC_REGISTER_EVENT_TYPE_SUBMITTED
      }
    })
    logger.info?.(
      { topicArn, applicationId, applicationReference },
      'Published public register submitted event to SNS'
    )
  } catch (error) {
    logger.error(
      structureErrorForECS(error),
      `Failed to publish public register event for ${applicationReference}`
    )
  }
}
