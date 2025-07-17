import Boom from '@hapi/boom'
import Wreck from '@hapi/wreck'
import { config } from '../../../config.js'

export const getDynamicsAccessToken = async (server) => {
  const { clientId, clientSecret, scope, tokenUrl } = config.get('dynamics')

  const response = await Wreck.post(tokenUrl, {
    payload: {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope
    },
    json: true
  })

  if (!response.payload.access_token) {
    throw Boom.badImplementation('No access_token in response')
  }

  return response.payload.access_token
}
