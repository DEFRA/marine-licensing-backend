import { structureErrorForECS } from '../logging/logger.js'

// `transform` runs inside the same try/catch as JSON.parse so callers can layer
// their own validation on top without duplicating the parse/log/discard dance.
export const parseMessageBody = (
  message,
  logger,
  discardMessage,
  transform = (body) => body
) => {
  try {
    return transform(JSON.parse(message.Body))
  } catch (error) {
    logger.error(structureErrorForECS(error), discardMessage)
    return null
  }
}
