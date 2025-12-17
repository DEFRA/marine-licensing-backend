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
 * Builds a detailed error message, optionally including any response or data payload
 * so that it is visible in the standard `error.message` field consumed by CDP.
 * @param {Error} error - The error object
 * @returns {string} The combined error message
 */
function buildErrorMessage(error) {
  const baseMessage =
    (error && typeof error.message === 'string' && error.message) ||
    String(error)

  // Prefer explicit `data` on the error (e.g. ErrorWithData), otherwise fall back
  // to common HTTP client patterns like `error.response.data`.
  const payload =
    (error && typeof error === 'object' && 'data' in error && error.data) ||
    error?.response?.data

  if (!payload) {
    return baseMessage
  }

  try {
    const serialisedPayload =
      typeof payload === 'string' ? payload : JSON.stringify(payload)

    // Append a short, parseable suffix so CDP dashboards can surface the upstream
    // response alongside the primary error message.
    return `${baseMessage} | response: ${serialisedPayload}`
  } catch {
    // Fallback to the base message if serialisation fails
    return baseMessage
  }
}

/**
 * Builds the error details object
 * @param {Error} error - The error object
 * @returns {Object} Error details with message, stack_trace, type, and code
 */
function buildErrorDetails(error) {
  return {
    message: buildErrorMessage(error),
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
