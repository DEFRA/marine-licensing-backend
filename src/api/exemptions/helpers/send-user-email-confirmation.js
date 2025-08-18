import { config } from '../../../config.js'
import { NotifyClient } from 'notifications-node-client'
import { createLogger } from '../../../common/helpers/logging/logger.js'
import { retryAsyncOperation } from '../../../common/helpers/retry-async-operation.js'
import { ErrorWithData } from '../../../common/helpers/error-with-data.js'

const sendEmail = async ({
  userName,
  userEmail,
  applicationReference,
  frontEndBaseUrl,
  exemptionId
}) => {
  const logger = createLogger()
  const { apiKey, retryIntervalSeconds, retries, notifyTemplateId } =
    config.get('notify')
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
      viewDetailsUrl
    },
    reference: emailSendReference
  }
  try {
    const result = await retryAsyncOperation({
      operation: async () => {
        try {
          const response = await notifyClient.sendEmail(
            notifyTemplateId,
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
    logger.info(`Sent confirmation email for exemption ${applicationReference}`)
    return { status: 'success', id, reference: emailSendReference }
  } catch (error) {
    const errors = JSON.stringify(error.data)
    logger.error(
      `Error sending email for exemption ${applicationReference}: ${errors}`
    )
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
  applicationReference,
  frontEndBaseUrl,
  exemptionId
}) => {
  const result = await sendEmail({
    userName,
    userEmail,
    applicationReference,
    frontEndBaseUrl,
    exemptionId
  })
  db.collection('email-queue')?.insertOne({
    applicationReferenceNumber: applicationReference,
    ...result
  })
}
