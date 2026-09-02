import { config } from '../../../config.js'
import { publishMessage } from '../../../shared/common/helpers/sns/sns-client.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'
import { EXEMPTION_STATUS_LABEL } from '../../constants/exemption.js'

export const PUBLIC_REGISTER_APPLICATION_TYPE = 'exemption'
export const PUBLIC_REGISTER_EVENT_TYPE_SUBMITTED = 'submitted'
export const PUBLIC_REGISTER_EVENT_TYPE_WITHDRAWN = 'withdrawn'

/**
 * @param {{
 *   applicationId: string,
 *   applicationReference: string,
 *   projectName: string,
 *   marinePlanAreas?: string[],
 *   submittedAt: Date | string,
 *   status?: string
 * }} params
 */
export const buildPublicRegisterSubmittedPayload = ({
  applicationId,
  applicationReference,
  projectName,
  marinePlanAreas = [],
  submittedAt,
  status = EXEMPTION_STATUS_LABEL.ACTIVE
}) => ({
  applicationType: PUBLIC_REGISTER_APPLICATION_TYPE,
  eventType: PUBLIC_REGISTER_EVENT_TYPE_SUBMITTED,
  applicationId,
  applicationReference,
  projectName,
  marinePlanAreas,
  dateSubmitted:
    submittedAt instanceof Date ? submittedAt.toISOString() : submittedAt,
  status
})

/**
 * @param {{
 *   applicationId: string,
 *   applicationReference: string,
 *   projectName: string,
 *   marinePlanAreas?: string[],
 *   submittedAt: Date | string
 * }} params
 */
export const buildPublicRegisterWithdrawnPayload = ({
  applicationId,
  applicationReference,
  projectName,
  marinePlanAreas = [],
  submittedAt
}) => ({
  applicationType: PUBLIC_REGISTER_APPLICATION_TYPE,
  eventType: PUBLIC_REGISTER_EVENT_TYPE_WITHDRAWN,
  applicationId,
  applicationReference,
  projectName,
  marinePlanAreas,
  dateSubmitted:
    submittedAt instanceof Date ? submittedAt.toISOString() : submittedAt,
  status: EXEMPTION_STATUS_LABEL.WITHDRAWN
})

/**
 * Publish a public-register event to SNS. Failures are logged and do not fail
 * the calling workflow.
 *
 * @param {Record<string, unknown> & {
 *   applicationType: string,
 *   eventType: string,
 *   applicationId: string,
 *   applicationReference: string,
 *   logger: { error: Function, info?: Function }
 * }} params
 */
export const publishPublicRegisterEvent = async ({
  applicationType,
  eventType,
  applicationId,
  applicationReference,
  logger,
  ...listFields
}) => {
  const topicArn = config.get('publicRegister.snsTopicArn')
  const message = {
    applicationType,
    eventType,
    applicationId,
    applicationReference,
    ...listFields
  }

  try {
    await publishMessage(topicArn, JSON.stringify(message), {
      applicationType: {
        DataType: 'String',
        StringValue: applicationType
      },
      eventType: {
        DataType: 'String',
        StringValue: eventType
      }
    })
    logger.info?.(
      {
        event: {
          action: 'public-register-publish',
          outcome: 'success',
          reference: applicationId
        }
      },
      `Published public register ${eventType} event for ${applicationReference}`
    )
  } catch (error) {
    logger.error(
      structureErrorForECS(error),
      `Failed to publish public register event for ${applicationReference}`
    )
  }
}

/**
 * @param {Parameters<typeof buildPublicRegisterSubmittedPayload>[0] & {
 *   logger: { error: Function, info?: Function }
 * }} params
 */
export const publishPublicRegisterSubmittedEvent = async (params) => {
  const { logger, ...payloadParams } = params

  await publishPublicRegisterEvent({
    ...buildPublicRegisterSubmittedPayload(payloadParams),
    logger
  })
}

/**
 * @param {Parameters<typeof buildPublicRegisterWithdrawnPayload>[0] & {
 *   logger: { error: Function, info?: Function }
 * }} params
 */
export const publishPublicRegisterWithdrawnEvent = async (params) => {
  const { logger, ...payloadParams } = params

  await publishPublicRegisterEvent({
    ...buildPublicRegisterWithdrawnPayload(payloadParams),
    logger
  })
}
