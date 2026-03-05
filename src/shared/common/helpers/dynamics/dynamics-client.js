import Boom from '@hapi/boom'
import Wreck from '@hapi/wreck'
import { config } from '../../../../config.js'
import {
  EXEMPTION_STATUS,
  EXEMPTION_TYPE
} from '../../../../exemptions/constants/exemption.js'
import { StatusCodes } from 'http-status-codes'
import {
  DYNAMICS_REQUEST_ACTIONS,
  DYNAMICS_QUEUE_TYPES,
  REQUEST_QUEUE_STATUS
} from '../../constants/request-queue.js'
import {
  collectionExemptions,
  collectionDynamicsQueue,
  collectionMarineLicenceDynamicsQueue,
  collectionMarineLicences
} from '../../constants/db-collections.js'
import { createLogger } from '../../helpers/logging/logger.js'
import { MARINE_LICENCE_STATUS } from '../../../../marine-licences/constants/marine-licence.js'

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
 * Fetches a marine licence from the database by application reference
 * @param {Object} db - Database connection
 * @param {string} applicationReferenceNumber - Application reference number
 * @returns {Promise<Object>} The marine licence document
 */
const fetchMarineLicence = async (db, applicationReferenceNumber) => {
  const marineLicence = await db
    .collection(collectionMarineLicences)
    .findOne({ applicationReference: applicationReferenceNumber })

  if (!marineLicence) {
    throw Boom.notFound(
      `Marine licence not found for applicationReference: ${applicationReferenceNumber}`
    )
  }

  return marineLicence
}

/**
 * Updates the queue status to IN_PROGRESS
 * @param {Object} db - Database connection
 * @param {Object} queueItemId - Queue id
 * @param {string} collectionName - The queue collection to update
 */
const updateQueueStatus = async (db, queueItemId, collectionName) => {
  const result = await db.collection(collectionName).updateOne(
    { _id: queueItemId },
    {
      $set: {
        status: REQUEST_QUEUE_STATUS.IN_PROGRESS,
        updatedAt: new Date()
      }
    }
  )

  if (result.matchedCount === 0) {
    logger.error(
      { queueItemId, collection: collectionName },
      'Queue item not found when updating status to IN_PROGRESS'
    )
  }
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
  const applicantOrganisationId = exemption.organisation?.id

  return {
    contactid: exemption.contactId,
    projectName: exemption.projectName,
    reference: applicationReferenceNumber,
    type: EXEMPTION_TYPE.EXEMPT_ACTIVITY,
    applicationUrl: `${frontEndBaseUrl}/view-details/${exemption._id}`,
    ...(applicantOrganisationId ? { applicantOrganisationId } : {}),
    status: EXEMPTION_STATUS.SUBMITTED,
    marinePlanAreas: exemption.marinePlanAreas ?? [],
    coastalOperationsAreas: exemption.coastalOperationsAreas ?? []
  }
}

/**
 * Validates the Dynamics API response
 * @param {number} statusCode - HTTP status code
 * @param {string} applicationReferenceNumber - Application reference number
 * @param {string} operation - Operation name for logging
 */
const validateDynamicsResponse = (
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
        operation,
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
 * @param {string} operation - Operation name for logging
 * @param {string} message - Log message
 */
const logDynamicsSuccess = (
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
      operation,
      applicationReference: applicationReferenceNumber
    },
    message
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
  await updateQueueStatus(server.db, queueItem._id, collectionDynamicsQueue)
  const exemption = await fetchExemption(server.db, applicationReferenceNumber)

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
  validateDynamicsResponse(
    statusCode,
    applicationReferenceNumber,
    'sendExemption'
  )
  logDynamicsSuccess(
    statusCode,
    applicationReferenceNumber,
    'sendExemption',
    'Successfully sent exemption to Dynamics 365'
  )

  return response.payload
}

export const sendWithdrawToDynamics = async (
  server,
  accessToken,
  queueItem
) => {
  const {
    exemptions: { withdrawUrl }
  } = config.get('dynamics')
  const { applicationReferenceNumber } = queueItem

  await updateQueueStatus(server.db, queueItem._id, collectionDynamicsQueue)

  const payload = {
    status: EXEMPTION_STATUS.WITHDRAWN,
    reference: applicationReferenceNumber
  }

  const response = await Wreck.post(`${withdrawUrl}`, {
    payload,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  const statusCode = response.res?.statusCode
  validateDynamicsResponse(
    statusCode,
    applicationReferenceNumber,
    'withdrawExemption'
  )
  logDynamicsSuccess(
    statusCode,
    applicationReferenceNumber,
    'withdrawExemption',
    'Successfully sent request to withdraw exemption to Dynamics 365'
  )

  return response.payload
}

export const sendMarineLicenceToDynamics = async (
  server,
  accessToken,
  queueItem
) => {
  const {
    marineLicence: { apiUrl }
  } = config.get('dynamics')

  const { applicationReferenceNumber } = queueItem

  const frontEndBaseUrl = config.get('frontEndBaseUrl')

  await updateQueueStatus(
    server.db,
    queueItem._id,
    collectionMarineLicenceDynamicsQueue
  )

  const marineLicence = await fetchMarineLicence(
    server.db,
    applicationReferenceNumber
  )

  const payload = {
    contactid: marineLicence.contactId,
    projectName: marineLicence.projectName,
    reference: applicationReferenceNumber,
    applicationUrl: `${frontEndBaseUrl}/view-details/${marineLicence._id}`,
    ...(marineLicence.organisation?.id
      ? { applicantOrganisationId: marineLicence.organisation.id }
      : {}),
    status: MARINE_LICENCE_STATUS.SUBMITTED
  }

  const response = await Wreck.post(`${apiUrl}`, {
    payload,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  const statusCode = response.res?.statusCode
  validateDynamicsResponse(
    statusCode,
    applicationReferenceNumber,
    'sendMarineLicence'
  )
  logDynamicsSuccess(
    statusCode,
    applicationReferenceNumber,
    'sendMarineLicence',
    'Successfully sent Marine Licence to Dynamics 365'
  )

  return response.payload
}

export const sendToDynamics = async (server, accessToken, queueItem) => {
  if (queueItem.type === DYNAMICS_QUEUE_TYPES.MARINE_LICENCE) {
    return sendMarineLicenceToDynamics(server, accessToken, queueItem)
  }
  if (queueItem.action === DYNAMICS_REQUEST_ACTIONS.WITHDRAW) {
    return sendWithdrawToDynamics(server, accessToken, queueItem)
  }
  return sendExemptionToDynamics(server, accessToken, queueItem)
}
