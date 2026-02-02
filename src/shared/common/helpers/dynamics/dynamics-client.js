import Boom from '@hapi/boom'
import Wreck from '@hapi/wreck'
import { config } from '../../../../config.js'
import {
  EXEMPTION_STATUS,
  EXEMPTION_TYPE
} from '../../../../exemptions/constants/exemption.js'
import { StatusCodes } from 'http-status-codes'
import { REQUEST_QUEUE_STATUS } from '../../constants/request-queue.js'
import { collectionExemptions } from '../../constants/db-collections.js'
import { isOrganisationEmployee } from '../organisations.js'
import { createLogger } from '../../helpers/logging/logger.js'

const logger = createLogger()

/**
 * Fetches an exemption from the database by application reference
 * @param {Object} db - Database connection
 * @param {string} applicationReferenceNumber - Application reference number
 * @returns {Promise<Object>} The exemption document
 */
const fetchExemption = async (db, applicationReferenceNumber) => {
  const exemption = await db.collection(collectionExemptions).findOne({
    applicationReference: applicationReferenceNumber
  })

  if (!exemption) {
    throw Boom.notFound(
      `Exemption not found for applicationReference: ${applicationReferenceNumber}`
    )
  }

  return exemption
}

/**
 * Updates the queue status to IN_PROGRESS
 * @param {Object} db - Database connection
 * @param {string} exemptionId - Exemption ID
 */
const updateQueueStatus = async (db, exemptionId) => {
  await db.collection('exemption-dynamics-queue').updateOne(
    { _id: exemptionId },
    {
      $set: {
        status: REQUEST_QUEUE_STATUS.IN_PROGRESS,
        updatedAt: new Date()
      }
    }
  )
}

/**
 * Builds the Dynamics API payload
 * @param {Object} exemption - The exemption document
 * @param {string} applicationReferenceNumber - Application reference number
 * @param {string} frontEndBaseUrl - Frontend base URL
 * @returns {Object} The payload for Dynamics API
 */
const buildDynamicsPayload = (
  exemption,
  applicationReferenceNumber,
  frontEndBaseUrl
) => {
  const organisationId = exemption.organisation?.id
  const beneficiaryOrganisationId = organisationId
  const applicantOrganisationId = isOrganisationEmployee(exemption.organisation)
    ? organisationId
    : undefined

  return {
    contactid: exemption.contactId,
    projectName: exemption.projectName,
    reference: applicationReferenceNumber,
    type: EXEMPTION_TYPE.EXEMPT_ACTIVITY,
    applicationUrl: `${frontEndBaseUrl}/view-details/${exemption._id}`,
    ...(applicantOrganisationId ? { applicantOrganisationId } : {}),
    ...(beneficiaryOrganisationId ? { beneficiaryOrganisationId } : {}),
    status: EXEMPTION_STATUS.SUBMITTED,
    marinePlanAreas: exemption.marinePlanAreas ?? [],
    coastalEnforcementAreas: exemption.coastalEnforcementAreas ?? []
  }
}

/**
 * Validates the Dynamics API response
 * @param {number} statusCode - HTTP status code
 * @param {string} applicationReferenceNumber - Application reference number
 */
const validateDynamicsResponse = (statusCode, applicationReferenceNumber) => {
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
        operation: 'sendExemption',
        applicationReference: applicationReferenceNumber
      },
      `Dynamics API returned unexpected status ${statusCode}`
    )
    throw Boom.badImplementation(`Dynamics API returned status ${statusCode}`)
  }
}

/**
 * Logs successful Dynamics API request
 * @param {number} statusCode - HTTP status code
 * @param {string} applicationReferenceNumber - Application reference number
 */
const logDynamicsSuccess = (statusCode, applicationReferenceNumber) => {
  logger.info(
    {
      http: {
        response: {
          status_code: statusCode
        }
      },
      service: 'dynamics',
      operation: 'sendExemption',
      applicationReference: applicationReferenceNumber
    },
    'Successfully sent exemption to Dynamics 365'
  )
}

export const sendExemptionToDynamics = async (
  server,
  accessToken,
  queueItem
) => {
  const {
    exemptions: { apiUrl }
  } = config.get('dynamics')
  const frontEndBaseUrl = config.get('frontEndBaseUrl')
  const { applicationReferenceNumber } = queueItem

  // Fetch exemption and update queue status
  const exemption = await fetchExemption(server.db, applicationReferenceNumber)
  await updateQueueStatus(server.db, exemption._id)

  // Build payload and send to Dynamics
  const payload = buildDynamicsPayload(
    exemption,
    applicationReferenceNumber,
    frontEndBaseUrl
  )

  const response = await Wreck.post(`${apiUrl}/exemptions`, {
    payload,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  // Validate and log response
  const statusCode = response.res?.statusCode
  validateDynamicsResponse(statusCode, applicationReferenceNumber)
  logDynamicsSuccess(statusCode, applicationReferenceNumber)

  return response.payload
}
