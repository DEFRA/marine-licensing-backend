import Wreck from '@hapi/wreck'
import { config } from '../../../../../config.js'
import {
  logDynamicsSuccess,
  validateDynamicsResponse
} from '../dynamics-response.js'
import { fetchExemption } from './send-exemption.js'

/**
 * Builds the Dynamics API payload for exemption update
 * @param {Object} exemption - The exemption document
 * @param {string} applicationReferenceNumber - Application reference number
 * @returns {Object} The payload for Dynamics update API
 */
const buildUpdateDynamicsPayload = (exemption, applicationReferenceNumber) => ({
  reference: applicationReferenceNumber,
  marinePlanAreas: exemption.marinePlanAreas ?? [],
  coastalOperationsAreas: exemption.coastalOperationsAreas ?? []
})

export const sendUpdateExemptionToDynamics = async (
  server,
  accessToken,
  queueItem
) => {
  const {
    exemptions: { updateUrl }
  } = config.get('dynamics')
  const { applicationReferenceNumber } = queueItem

  const exemption = await fetchExemption(server.db, applicationReferenceNumber)

  const payload = buildUpdateDynamicsPayload(
    exemption,
    applicationReferenceNumber
  )

  const response = await Wreck.post(updateUrl, {
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
    'update-exemption'
  )
  logDynamicsSuccess(
    statusCode,
    applicationReferenceNumber,
    'update-exemption',
    'Successfully sent exemption update to Dynamics 365'
  )

  return response.payload
}
