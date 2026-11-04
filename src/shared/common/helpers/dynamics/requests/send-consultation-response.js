import Wreck from '@hapi/wreck'
import { config } from '../../../../../config.js'
import {
  logDynamicsSuccess,
  validateDynamicsResponse
} from '../dynamics-response.js'

export const sendConsultationResponseToDynamics = async (
  _server,
  accessToken,
  queueItem
) => {
  const {
    marineLicences: { apiUrl, httpTimeoutMs }
  } = config.get('dynamics')
  const { action, applicationReferenceNumber, organisationId, response } =
    queueItem

  const payload = {
    action,
    reference: applicationReferenceNumber,
    organisationId,
    response
  }

  const dynamicsResponse = await Wreck.post(apiUrl, {
    payload,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    timeout: httpTimeoutMs
  })

  const statusCode = dynamicsResponse.res?.statusCode
  validateDynamicsResponse(
    statusCode,
    applicationReferenceNumber,
    'send-consultation-response'
  )
  logDynamicsSuccess(
    statusCode,
    applicationReferenceNumber,
    'send-consultation-response',
    'Successfully sent consultation response to Dynamics 365'
  )

  return dynamicsResponse.payload
}
