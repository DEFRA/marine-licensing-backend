import Wreck from '@hapi/wreck'
import { config } from '../../../../../config.js'
import {
  logDynamicsSuccess,
  validateDynamicsResponse
} from '../dynamics-response.js'

export const sendSiteNoticeEvidenceToDynamics = async (
  _server,
  accessToken,
  queueItem
) => {
  const {
    marineLicences: { updateUrl, httpTimeoutMs }
  } = config.get('dynamics')
  const { applicationReferenceNumber, action, type, locationCount, locations } =
    queueItem

  const payload = {
    applicationReferenceNumber,
    action,
    type,
    locationCount,
    locations
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
    'send-site-notice-evidence'
  )
  logDynamicsSuccess(
    statusCode,
    applicationReferenceNumber,
    'send-site-notice-evidence',
    'Successfully sent site notice evidence to Dynamics 365'
  )

  return dynamicsResponse.payload
}
