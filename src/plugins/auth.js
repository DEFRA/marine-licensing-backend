import { createPublicKey } from 'node:crypto'
import Wreck from '@hapi/wreck'
import { config } from '../config.js'
import Boom from '@hapi/boom'
import { createLogger } from '../common/helpers/logging/logger.js'

export const getJwtAuthStrategy = (jwt) => {
  if (!jwt) {
    return null
  }
  if (jwt.tid) {
    return 'entraId'
  }
  return 'defraId'
}

export const getKeys = async (token) => {
  const authStrategy = getJwtAuthStrategy(token)
  const { jwksUri } = config.get(authStrategy)
  const logger = createLogger()
  try {
    const { payload } = await Wreck.get(jwksUri, { json: true })
    const { keys } = payload
    if (!keys?.length) {
      logger.error('No keys found in JWKS response')
      return { key: null }
    }
    const pems = keys.map((key) =>
      createPublicKey({ key, format: 'jwk' }).export({
        type: 'spki',
        format: 'pem'
      })
    )
    return { key: pems }
  } catch (e) {
    throw Boom.internal('Cannot get JWT validation keys', e)
  }
}

export const validateToken = async (decoded) => {
  const authStrategy = getJwtAuthStrategy(decoded)

  // For Entra ID tokens, use 'oid' as contactId
  // For defraId tokens, use 'contactId'
  const contactId = authStrategy === 'entraId' ? decoded.oid : decoded.contactId
  const { email } = decoded

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
      server.auth.strategy('jwt', 'jwt', {
        key: getKeys,
        validate: validateToken,
        verifyOptions: {
          algorithms: ['RS256']
        }
      })
      server.auth.default({
        strategy: 'jwt',
        mode: 'required'
      })
    }
  }
}

export { auth }
