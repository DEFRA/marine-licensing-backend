import {
  DYNAMICS_REQUEST_ACTIONS,
  DYNAMICS_QUEUE_TYPES
} from '../../constants/request-queue.js'
import { sendConsultationResponseToDynamics } from './requests/send-consultation-response.js'
import { sendExemptionToDynamics } from './requests/send-exemption.js'
import { sendMarineLicenceToDynamics } from './requests/send-marine-licence.js'
import { sendUpdateExemptionToDynamics } from './requests/send-update-exemption.js'
import { sendWithdrawToDynamics } from './requests/send-withdraw.js'

const getHandler = (queueItem) => {
  if (queueItem.action === DYNAMICS_REQUEST_ACTIONS.WITHDRAW) {
    return sendWithdrawToDynamics
  }
  if (
    queueItem.action === DYNAMICS_REQUEST_ACTIONS.SEND_CONSULTATION_RESPONSE
  ) {
    return sendConsultationResponseToDynamics
  }
  if (queueItem.type === DYNAMICS_QUEUE_TYPES.MARINE_LICENCE) {
    return sendMarineLicenceToDynamics
  }
  if (queueItem.action === DYNAMICS_REQUEST_ACTIONS.UPDATE) {
    return sendUpdateExemptionToDynamics
  }
  return sendExemptionToDynamics
}

export const sendToDynamics = async (server, accessToken, queueItem) => {
  const handler = getHandler(queueItem)
  return handler(server, accessToken, queueItem)
}
