import Wreck from '@hapi/wreck'
import jwkToPem from 'jwk-to-pem'
import { config } from '../config.js'
import Boom from '@hapi/boom'

export const getJwtAuthStrategy = (jwt) => {
  if (jwt.tid) {
    return 'entraId'
  }
  return 'defraId'
}

export const getKeys = async (token) => {
  const authStrategy = getJwtAuthStrategy(token)
  const { jwksUri } = config.get(authStrategy)
  try {
    const { payload } = await Wreck.get(jwksUri, { json: true })
    const { keys } = payload
    if (!keys?.length) {
      console.error('No keys found in JWKS response')
      return { key: null }
    }
    const pems = keys.map((key) => jwkToPem(key))
    return { key: pems }
  } catch (e) {
    throw Boom.internal('Cannot get JWT validation keys', e)
  }
}

export const validateToken = async (decoded) => {
  const { authEnabled } = config.get('defraId')

  if (!authEnabled) {
    return { isValid: true }
  }

  const { contactId, email } = decoded
  const authStrategy = getJwtAuthStrategy(decoded)
  if (authStrategy === 'defraId' && !contactId) {
    return { isValid: false }
  }

  return {
    isValid: true,
    credentials: {
      contactId,
      email
    }
  }
}

const auth = {
  plugin: {
    name: 'auth',
    register: async (server) => {
      const defraIdConfig = config.get('defraId')
      server.auth.strategy('jwt', 'jwt', {
        key: getKeys,
        validate: validateToken,
        verifyOptions: {
          algorithms: ['RS256']
        }
      })
      server.auth.default({
        strategy: 'jwt',
        mode: defraIdConfig.authEnabled ? 'required' : 'try' //
      })
    }
  }
}

export { auth }
