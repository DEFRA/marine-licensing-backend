import { config } from '../../../config.js'
import { NotifyClient } from 'notifications-node-client'
import {
  createLogger,
  structureErrorForECS
} from '../../../common/helpers/logging/logger.js'
import { retryAsyncOperation } from '../../../common/helpers/retry-async-operation.js'
import { ErrorWithData } from '../../../common/helpers/error-with-data.js'
import { isOrganisationEmployee } from '../../../common/helpers/organisations.js'

const getNotifyTemplateId = (organisation) => {
  if (isOrganisationEmployee(organisation)) {
    return config.get('notify.notifyTemplateIdEmployee')
  }
  if (organisation?.userRelationshipType === 'Agent') {
    return config.get('notify.notifyTemplateIdAgent')
  }
  return config.get('notify.notifyTemplateId')
}

const sendEmail = async ({
  userName,
  userEmail,
  organisation,
  applicationReference,
  frontEndBaseUrl,
  exemptionId
}) => {
  const logger = createLogger()
  const { apiKey, retryIntervalSeconds, retries } = config.get('notify')
  if (!apiKey) {
    throw new Error('Notify API key is not set')
  }
  const notifyClient = new NotifyClient(apiKey)
  const emailSendReference = applicationReference
  const viewDetailsUrl = `${frontEndBaseUrl}/exemption/view-details/${exemptionId}`
  const options = {
    personalisation: {
      name: userName,
      reference: applicationReference,
      viewDetailsUrl,
      organisationName: organisation?.name
    },
    reference: emailSendReference
  }
  try {
    const result = await retryAsyncOperation({
      operation: async () => {
        try {
          const templateId = getNotifyTemplateId(organisation)
          const response = await notifyClient.sendEmail(
            templateId,
            userEmail,
            options
          )
          return response
        } catch (error) {
          throw new ErrorWithData(
            'Error sending email',
            error.response?.data?.errors
          )
        }
      },
      retries,
      intervalMs: retryIntervalSeconds * 1000
    })
    const { id } = result.data
    const statusCode = result?.statusCode || result?.response?.statusCode || 201
    logger.info(
      {
        http: {
          response: {
            status_code: statusCode
          }
        },
        service: 'gov-notify',
        operation: 'sendEmail',
        applicationReference
      },
      `Sent confirmation email for exemption ${applicationReference}`
    )
    return { status: 'success', id, reference: emailSendReference }
  } catch (error) {
    // Ensure we have an Error object for structured logging
    const emailError =
      error instanceof Error
        ? error
        : new Error(`Error sending email for exemption ${applicationReference}`)
    if (!emailError.code) {
      emailError.code = 'EMAIL_SEND_ERROR'
    }

    // Extract HTTP status code from error response
    const statusCode =
      error.response?.statusCode ||
      error.statusCode ||
      error.status ||
      (error instanceof ErrorWithData && error.data ? undefined : undefined)

    logger.error(
      {
        ...structureErrorForECS(emailError),
        http: statusCode
          ? {
              response: {
                status_code: statusCode
              }
            }
          : undefined,
        service: 'gov-notify',
        operation: 'sendEmail',
        applicationReference
      },
      `Error sending email for exemption ${applicationReference}`
    )
    const errors =
      error instanceof ErrorWithData && error.data
        ? JSON.stringify(error.data)
        : undefined
    return {
      status: 'error',
      errors,
      reference: emailSendReference
    }
  }
}

export const sendUserEmailConfirmation = async ({
  db,
  userName,
  userEmail,
  organisation,
  applicationReference,
  frontEndBaseUrl,
  exemptionId
}) => {
  const result = await sendEmail({
    userName,
    userEmail,
    organisation,
    applicationReference,
    frontEndBaseUrl,
    exemptionId
  })
  db.collection('email-queue')?.insertOne({
    applicationReferenceNumber: applicationReference,
    ...result
  })
}
