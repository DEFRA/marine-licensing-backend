import Wreck from '@hapi/wreck'
import jwkToPem from 'jwk-to-pem'
import { config } from '../config.js'
import Boom from '@hapi/boom'

export const getKey = async () => {
  const { jwksUri } = config.get('defraId')
  try {
    const { payload } = await Wreck.get(jwksUri, { json: true })
    const { keys } = payload
    if (!keys?.length) {
      return { key: undefined }
    }
    const pem = jwkToPem(keys[0])
    return { key: pem }
  } catch (e) {
    throw Boom.internal('Cannot verify auth token')
  }
}

export const validateToken = async (decoded) => {
  const { id, email } = decoded

  if (!id) {
    return { isValid: false }
  }

  return {
    isValid: true,
    credentials: {
      userId: id,
      email
    }
  }
}

const auth = {
  plugin: {
    name: 'auth',
    register: async (server) => {
      server.auth.strategy('jwt', 'jwt', {
        key: getKey,
        validate: validateToken,
        verifyOptions: {
          algorithms: ['RS256']
        }
      })
      server.auth.default({ strategy: 'jwt', mode: 'required' })
    }
  }
}

export { auth }
