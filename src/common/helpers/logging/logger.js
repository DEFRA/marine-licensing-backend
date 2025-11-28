import { pino } from 'pino'

import { loggerOptions } from './logger-options.js'

const logger = pino(loggerOptions)

function createLogger() {
  return logger
}

/**
 * Extracts HTTP status code from various error object locations
 * @param {Error} error - The error object
 * @returns {number|undefined} The status code if found
 */
function extractHttpStatusCode(error) {
  return (
    error.response?.statusCode ||
    error.res?.statusCode ||
    error.statusCode ||
    error.status ||
    error.output?.statusCode
  )
}

/**
 * Builds the HTTP context object for logging
 * @param {number|undefined} statusCode - The HTTP status code
 * @returns {Object|undefined} HTTP context object or undefined
 */
function buildHttpContext(statusCode) {
  return statusCode
    ? {
        response: {
          status_code: statusCode
        }
      }
    : undefined
}

/**
 * Builds the error details object
 * @param {Error} error - The error object
 * @returns {Object} Error details with message, stack_trace, type, and code
 */
function buildErrorDetails(error) {
  return {
    message: error.message || String(error),
    stack_trace: error.stack || undefined,
    type: error.name || error.constructor?.name || 'Error',
    code: error.code || error.statusCode || undefined
  }
}

/**
 * Removes undefined fields from an object
 * @param {Object} obj - The object to clean
 * @returns {Object} The cleaned object
 */
function removeUndefinedFields(obj) {
  const cleaned = { ...obj }
  for (const key of Object.keys(cleaned)) {
    if (cleaned[key] === undefined) {
      delete cleaned[key]
    }
  }
  return cleaned
}

/**
 * Structures an error object according to ECS (Elastic Common Schema) format
 * @param {Error} error - The error object to structure
 * @returns {Object} ECS-formatted error object with error.message, error.stack_trace, error.type, error.code, and http.response.status_code if available
 */
function structureErrorForECS(error) {
  if (!error) {
    return {}
  }

  const statusCode = extractHttpStatusCode(error)
  const errorDetails = buildErrorDetails(error)
  const cleanedErrorDetails = removeUndefinedFields(errorDetails)

  const errorObj = {
    error: cleanedErrorDetails
  }

  const httpContext = buildHttpContext(statusCode)
  if (httpContext) {
    errorObj.http = httpContext
  }

  return errorObj
}

export { createLogger, structureErrorForECS }
