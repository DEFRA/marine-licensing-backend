import Boom from '@hapi/boom'
import Wreck from '@hapi/wreck'
import { config } from '../../../../../config.js'
import {
  EXEMPTION_STATUS,
  EXEMPTION_TYPE
} from '../../../../../exemptions/constants/exemption.js'
import { collectionExemptions } from '../../../constants/db-collections.js'
import {
  logDynamicsSuccess,
  validateDynamicsResponse
} from '../dynamics-response.js'

/**
 * Fetches an exemption from the database by application reference
 * @param {Object} db - Database connection
 * @param {string} applicationReferenceNumber - Application reference number
 * @returns {Promise<Object>} The exemption document
 */
export const fetchExemption = async (db, applicationReferenceNumber) => {
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
    'send-exemption'
  )
  logDynamicsSuccess(
    statusCode,
    applicationReferenceNumber,
    'send-exemption',
    'Successfully sent exemption to Dynamics 365'
  )

  return response.payload
}
