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
    marineLicences: { updateUrl, httpTimeoutMs }
  } = config.get('dynamics')
  const { applicationReferenceNumber, action, type, organisationId, response } =
    queueItem

  const payload = {
    applicationReferenceNumber,
    action,
    type,
    organisationId,
    response
  }

  const dynamicsResponse = await Wreck.post(updateUrl, {
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
