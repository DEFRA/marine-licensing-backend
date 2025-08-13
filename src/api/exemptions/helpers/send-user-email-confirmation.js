import { config } from '../../../config.js'
import { NotifyClient } from 'notifications-node-client'
import { createLogger } from '../../../common/helpers/logging/logger.js'
import { retryAsyncOperation } from '../../../common/helpers/retry-async-operation.js'

const sendEmail = async ({ userName, userEmail, applicationReference }) => {
  const logger = createLogger()
  const { apiKey, retryIntervalSeconds, retries } = config.get('notify')
  if (!apiKey) {
    throw new Error('Notify API key is not set')
  }
  const notifyClient = new NotifyClient(apiKey)
  const notifyTemplateId = 'a9f8607a-1a1b-4c49-87c0-b260824d2e12'
  const emailSendReference = applicationReference
  const options = {
    personalisation: {
      name: userName,
      reference: applicationReference
    },
    reference: emailSendReference
  }
  try {
    const result = await retryAsyncOperation({
      operation: () =>
        notifyClient.sendEmail(notifyTemplateId, userEmail, options),
      retries,
      intervalMs: retryIntervalSeconds * 1000
    })
    const { id } = result.data
    logger.info(`Sent confirmation email for exemption ${applicationReference}`)
    return { status: 'success', id, reference: emailSendReference }
  } catch (error) {
    const errors = JSON.stringify(error.response?.data?.errors)
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
  applicationReference
}) => {
  const result = await sendEmail({ userName, userEmail, applicationReference })
  db.collection('email-queue')?.insertOne({
    applicationReferenceNumber: applicationReference,
    ...result
  })
}
