import { structureErrorForECS } from '../logging/logger.js'

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
