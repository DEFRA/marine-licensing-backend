import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { createLogger } from '../logging/logger.js'

const logger = createLogger()

/**
 * Validates the Dynamics API response
 * @param {number} statusCode - HTTP status code
 * @param {string} applicationReferenceNumber - Application reference number
 * @param {string} operation - Operation name for logging
 */
export const validateDynamicsResponse = (
  statusCode,
  applicationReferenceNumber,
  operation
) => {
  if (statusCode !== StatusCodes.ACCEPTED) {
    logger.error(
      {
        error: {
          message: `Dynamics API returned status ${statusCode}`,
          code: 'DYNAMICS_API_ERROR'
        },
        http: {
          response: {
            status_code: statusCode
          }
        },
        service: 'dynamics',
        event: {
          action: operation,
          outcome: 'failure',
          reference: applicationReferenceNumber
        }
      },
      `Dynamics API returned unexpected status ${statusCode} for applicationReference ${applicationReferenceNumber}`
    )
    throw Boom.badImplementation(`Dynamics API returned status ${statusCode}`)
  }
}

/**
 * Logs successful Dynamics API request
 * @param {number} statusCode - HTTP status code
 * @param {string} applicationReferenceNumber - Application reference number
 * @param {string} operation - Operation name for logging
 * @param {string} message - Log message
 */
export const logDynamicsSuccess = (
  statusCode,
  applicationReferenceNumber,
  operation,
  message
) => {
  logger.info(
    {
      http: {
        response: {
          status_code: statusCode
        }
      },
      service: 'dynamics',
      event: {
        action: operation,
        outcome: 'success',
        reference: applicationReferenceNumber
      }
    },
    `${message} for applicationReference ${applicationReferenceNumber}`
  )
}
