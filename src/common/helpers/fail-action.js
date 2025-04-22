import { createLogger } from './logging/logger.js'

const logger = createLogger()

export function failAction(_request, h, error) {
  logger.warn(error, error?.message)

  if (!error.details) {
    throw error
  }

  const details = error.details.map((detail) => {
    return {
      field: detail.path.join('.'),
      message: detail.message,
      type: detail.type
    }
  })

  const response = {
    statusCode: 400,
    error: 'Bad Request',
    message: error.message,
    validation: {
      source: error.output.payload.validation.source,
      keys: error.output.payload.validation.keys,
      details
    }
  }

  return h.response(response).code(400).takeover()
}
