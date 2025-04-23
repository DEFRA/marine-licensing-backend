import { createLogger } from './logging/logger.js'

const logger = createLogger()

export function failAction(_request, h, error) {
  logger.warn(error, error?.message)

  if (error.name === 'ValidationError') {
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
