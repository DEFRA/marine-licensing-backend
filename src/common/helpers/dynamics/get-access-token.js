import { config } from '../../../config.js'
import Wreck from '@hapi/wreck'
import Boom from '@hapi/boom'
import querystring from 'node:querystring'

export const getDynamicsAccessToken = async ({ scopeType }) => {
  const { clientId, clientSecret, scope, tokenUrl } = config.get('dynamics')

  try {
    const response = await Wreck.post(tokenUrl, {
      payload: querystring.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope: scope[scopeType]
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
