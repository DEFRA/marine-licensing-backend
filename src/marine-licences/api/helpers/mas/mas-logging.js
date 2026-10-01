import { MAS_EVENT_ACTION } from '../../../constants/marine-licence.js'

export const logDiscarded = (
  logger,
  messagePrefix,
  applicationReference,
  reason
) =>
  logger.warn(
    {
      event: {
        action: MAS_EVENT_ACTION.APPLICATION_TASK_SKIPPED,
        outcome: 'failure',
        reference: applicationReference,
        reason
      }
    },
    `${messagePrefix} for applicationReference ${applicationReference}: ${reason}`
  )

export const logNoRecipient = (logger, messagePrefix, applicationReference) =>
  logger.warn(
    {
      event: {
        action: MAS_EVENT_ACTION.APPLICATION_TASK_SKIPPED,
        outcome: 'failure',
        reference: applicationReference,
        reason: 'no recipient on message'
      }
    },
    `${messagePrefix} for applicationReference ${applicationReference} but sent no email: the message carried no userEmail`
  )
