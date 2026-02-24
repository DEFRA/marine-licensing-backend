import { config } from '../../../config.js'
import { NotifyClient } from 'notifications-node-client'
import {
  createLogger,
  structureErrorForECS
} from '../../../shared/common/helpers/logging/logger.js'
import { retryAsyncOperation } from '../../../shared/common/helpers/retry-async-operation.js'
import { ErrorWithData } from '../../../shared/common/helpers/error-with-data.js'
import { isOrganisationEmployee } from '../../../shared/common/helpers/organisations.js'
import { StatusCodes } from 'http-status-codes'

const getNotifyTemplateId = (organisation) => {
  if (isOrganisationEmployee(organisation)) {
    return config.get('notify.notifyTemplateIdEmployee')
  }
  if (organisation?.userRelationshipType === 'Agent') {
    return config.get('notify.notifyTemplateIdAgent')
  }
  return config.get('notify.notifyTemplateId')
}

const extractStatusCode = (error) => {
  return (
    error.statusCode ||
    error.response?.statusCode ||
    error.response?.status ||
    error.status
  )
}

const wrapNotifyError = (error) => {
  const wrappedError = new ErrorWithData(
    'Error sending email',
    error.response?.data?.errors
  )
  wrappedError.statusCode = extractStatusCode(error)
  return wrappedError
}

const buildHttpLogContext = (statusCode) => {
  return statusCode
    ? {
        response: {
          status_code: statusCode
        }
      }
    : undefined
}

const logEmailSuccess = (logger, applicationReference, statusCode) => {
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
}

const logEmailError = (
  logger,
  emailError,
  statusCode,
  applicationReference
) => {
  logger.error(
    {
      ...structureErrorForECS(emailError),
      http: buildHttpLogContext(statusCode),
      service: 'gov-notify',
      operation: 'sendEmail',
      applicationReference
    },
    `Error sending email for exemption ${applicationReference}`
  )
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
          return await notifyClient.sendEmail(templateId, userEmail, options)
        } catch (error) {
          throw wrapNotifyError(error)
        }
      },
      retries,
      intervalMs: retryIntervalSeconds * 1000
    })
    const { id } = result.data
    // Gov Notify returns CREATED (201) status on successful email creation
    logEmailSuccess(logger, applicationReference, StatusCodes.CREATED)
    return { status: 'success', id, reference: emailSendReference }
  } catch (error) {
    const emailError =
      error instanceof Error
        ? error
        : new Error(`Error sending email for exemption ${applicationReference}`)
    if (!emailError.code) {
      emailError.code = 'EMAIL_SEND_ERROR'
    }

    const statusCode = extractStatusCode(error)
    logEmailError(logger, emailError, statusCode, applicationReference)

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
