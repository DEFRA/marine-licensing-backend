import { createLogger } from './logging/logger.js'

const logger = createLogger()

const isValidationError = (error) => {
  return error.name === 'ValidationError' && !!error.output?.payload?.validation
}

export function failAction(_request, _h, error) {
  logger.warn(error, error?.message)

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
