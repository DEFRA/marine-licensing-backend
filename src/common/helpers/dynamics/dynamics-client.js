import Boom from '@hapi/boom'
import Wreck from '@hapi/wreck'
import { config } from '../../../config.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import querystring from 'node:querystring'
import { StatusCodes } from 'http-status-codes'

export const getDynamicsAccessToken = async () => {
  const { clientId, clientSecret, scope, tokenUrl } = config.get('dynamics')

  try {
    const response = await Wreck.post(tokenUrl, {
      payload: querystring.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })

    const responsePayload = JSON.parse(response.payload.toString('utf8'))

    if (!responsePayload.access_token) {
      throw Boom.badImplementation('No access_token in response')
    }

    return responsePayload.access_token
  } catch (error) {
    throw Boom.badImplementation(`Dynamics token request failed`, error)
  }
}

export const sendExemptionToDynamics = async (
  server,
  accessToken,
  queueItem
) => {
  const { apiUrl } = config.get('dynamics')

  const { applicationReferenceNumber } = queueItem

  const exemption = await server.db.collection('exemptions').findOne({
    applicationReference: applicationReferenceNumber
  })

  if (!exemption) {
    throw Boom.notFound(
      `Exemption not found for applicationReference: ${applicationReferenceNumber}`
    )
  }

  const payload = {
    contactid: exemption.contactId,
    projectName: exemption.projectName,
    reference: applicationReferenceNumber,
    type: exemption.type,
    applicationUrl:
      'https://marine-licensing-frontend.dev.cdp-int.defra.cloud/exemption',
    status: EXEMPTION_STATUS.SUBMITTED
  }

  const response = await Wreck.post(`${apiUrl}/exemptions`, {
    payload,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (response.res.statusCode !== StatusCodes.ACCEPTED) {
    throw Boom.badImplementation(
      `Dynamics API returned status ${response.res.statusCode}`
    )
  }

  return response.payload
}
