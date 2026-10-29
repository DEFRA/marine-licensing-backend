import Wreck from '@hapi/wreck'
import { config } from '../../../../../config.js'
import { EXEMPTION_STATUS } from '../../../../../exemptions/constants/exemption.js'
import { DYNAMICS_QUEUE_TYPES } from '../../../constants/request-queue.js'
import {
  logDynamicsSuccess,
  validateDynamicsResponse
} from '../dynamics-response.js'

export const sendWithdrawToDynamics = async (
  _server,
  accessToken,
  queueItem
) => {
  const {
    exemptions: { withdrawUrl },
    marineLicences: { httpTimeoutMs }
  } = config.get('dynamics')
  const { applicationReferenceNumber, type } = queueItem

  const isMarineLicence = type === DYNAMICS_QUEUE_TYPES.MARINE_LICENCE
  const subject = isMarineLicence ? 'marine licence' : 'exemption'
  const timeoutOption = isMarineLicence ? { timeout: httpTimeoutMs } : {}

  const payload = {
    status: EXEMPTION_STATUS.WITHDRAWN,
    reference: applicationReferenceNumber
  }

  const response = await Wreck.post(`${withdrawUrl}`, {
    payload,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    ...timeoutOption
  })

  const statusCode = response.res?.statusCode
  validateDynamicsResponse(statusCode, applicationReferenceNumber, 'withdraw')
  logDynamicsSuccess(
    statusCode,
    applicationReferenceNumber,
    'withdraw',
    `Successfully sent request to withdraw ${subject} to Dynamics 365`
  )

  return response.payload
}
