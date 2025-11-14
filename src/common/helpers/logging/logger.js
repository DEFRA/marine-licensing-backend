import { pino } from 'pino'

import { loggerOptions } from './logger-options.js'

const logger = pino(loggerOptions)

function createLogger() {
  return logger
}

/**
 * Structures an error object according to ECS (Elastic Common Schema) format
 * @param {Error} error - The error object to structure
 * @returns {Object} ECS-formatted error object with error.message, error.stack_trace, error.type, error.code
 */
function structureErrorForECS(error) {
  if (!error) {
    return {}
  }

  const errorObj = {
    error: {
      message: error.message || String(error),
      stack_trace: error.stack || undefined,
      type: error.name || error.constructor?.name || 'Error',
      code: error.code || error.statusCode || undefined
    }
  }

  // Remove undefined fields
  for (const key of Object.keys(errorObj.error)) {
    if (errorObj.error[key] === undefined) {
      delete errorObj.error[key]
    }
  }

  return errorObj
}

export { createLogger, structureErrorForECS }
