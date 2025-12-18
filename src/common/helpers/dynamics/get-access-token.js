import { config } from '../../../config.js'
import Wreck from '@hapi/wreck'
import Boom from '@hapi/boom'
import querystring from 'node:querystring'

export const getDynamicsAccessToken = async ({ type }) => {
  const dynamics = config.get('dynamics')
  const { clientId, clientSecret, scope } = dynamics[type]

  try {
    const response = await Wreck.post(dynamics.tokenUrl, {
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
