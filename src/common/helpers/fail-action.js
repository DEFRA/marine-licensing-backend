import { createLogger } from './logging/logger.js'

const logger = createLogger()

const safeLog = {
  warn: (error, message) => {
    if (logger && typeof logger.warn === 'function') {
      logger.warn(error, message)
    }
  },
  info: (message) => {
    if (logger && typeof logger.info === 'function') {
      logger.info(message)
    }
  },
  error: (message) => {
    if (logger && typeof logger.error === 'function') {
      logger.error(message)
    }
  }
}

const isValidationError = (error) => {
  return error.name === 'ValidationError' && !!error.output?.payload?.validation
}

export function failAction(_request, _h, error) {
  safeLog.warn(error, error?.message)

  if (isValidationError(error)) {
    error.output.payload.validation = {
      ...error.output.payload.validation,
      details: error.details.map((detail) => {
        return {
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type
        }
      })
    }
  }

  throw error
}

export { safeLog }
