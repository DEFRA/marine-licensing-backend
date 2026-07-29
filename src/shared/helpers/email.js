import { config } from '../../config.js'
import { NotifyClient } from 'notifications-node-client'
import {
  createLogger,
  structureErrorForECS
} from '../common/helpers/logging/logger.js'
import { retryAsyncOperation } from '../common/helpers/retry-async-operation.js'
import { ErrorWithData } from '../common/helpers/error-with-data.js'
import { StatusCodes } from 'http-status-codes'

export const extractStatusCode = (error) => {
  return (
    error.statusCode ||
    error.response?.statusCode ||
    error.response?.status ||
    error.status
  )
}

export const wrapNotifyError = (error) => {
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

export const logEmailSuccess = (
  logger,
  applicationReference,
  statusCode,
  projectType
) => {
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
    `Sent confirmation email for ${projectType} ${applicationReference}`
  )
}

export const logEmailError = (
  logger,
  emailError,
  statusCode,
  applicationReference,
  projectType
) => {
  logger.error(
    {
      ...structureErrorForECS(emailError),
      http: buildHttpLogContext(statusCode),
      service: 'gov-notify',
      operation: 'sendEmail',
      applicationReference
    },
    `Error sending email for ${projectType} ${applicationReference}`
  )
}

export const sendEmail = async ({
  templateId,
  userEmail,
  personalisation,
  applicationReference,
  projectType
}) => {
  const logger = createLogger()
  const { apiKey, retryIntervalSeconds, retries } = config.get('notify')
  if (!apiKey) {
    throw new Error('Notify API key is not set')
  }
  const notifyClient = new NotifyClient(apiKey)
  const emailSendReference = applicationReference
  const options = {
    personalisation,
    reference: emailSendReference
  }
  try {
    const result = await retryAsyncOperation({
      operation: async () => {
        try {
          return await notifyClient.sendEmail(templateId, userEmail, options)
        } catch (error) {
          throw wrapNotifyError(error)
        }
      },
      retries,
      intervalMs: retryIntervalSeconds * 1000
    })
    const { id } = result.data
    logEmailSuccess(
      logger,
      applicationReference,
      StatusCodes.CREATED,
      projectType
    )
    return { status: 'success', id, reference: emailSendReference }
  } catch (error) {
    const emailError =
      error instanceof Error
        ? error
        : new Error(
            `Error sending email for ${projectType} ${applicationReference}`
          )
    if (!emailError.code) {
      emailError.code = 'EMAIL_SEND_ERROR'
    }

    const statusCode = extractStatusCode(error)
    logEmailError(
      logger,
      emailError,
      statusCode,
      applicationReference,
      projectType
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
