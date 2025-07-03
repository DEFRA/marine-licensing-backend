import Wreck from '@hapi/wreck'
import jwkToPem from 'jwk-to-pem'
import { config } from '../config.js'
import Boom from '@hapi/boom'

export const getKey = async () => {
  const { jwksUri } = config.get('defraId')

  try {
    console.log(`Attempting to fetch JWKS from: ${jwksUri}`)
    const { payload } = await Wreck.get(jwksUri, { json: true })
    const { keys } = payload
    if (!keys?.length) {
      console.error('No keys found in JWKS response')
      return { key: null }
    }
    const pem = jwkToPem(keys[0])
    console.log('Successfully converted JWK to PEM')
    console.log('Returning', { key: pem })

    return { key: pem }
  } catch (e) {
    console.error('Failed to fetch JWKS:', e.message)
    console.error('JWKS URI was:', jwksUri)
    throw Boom.internal('Cannot verify auth token', e)
  }
}

export const validateToken = async (decoded) => {
  const { authEnabled } = config.get('defraId')

  if (!authEnabled) {
    return { isValid: true }
  }

  const { contactId, email } = decoded

  if (!contactId) {
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
      const { authEnabled } = config.get('defraId')

      server.auth.strategy('jwt', 'jwt', {
        key: getKey,
        validate: validateToken,
        verifyOptions: {
          algorithms: ['RS256']
        }
      })
      server.auth.default({
        strategy: 'jwt',
        mode: authEnabled ? 'required' : 'try'
      })
    }
  }
}

export { auth }
