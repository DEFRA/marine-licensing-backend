import { config } from '../../../config.js'
import Wreck from '@hapi/wreck'
import Boom from '@hapi/boom'
import querystring from 'node:querystring'
import { createLogger } from '../../helpers/logging/logger.js'

const logger = createLogger()

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

    const statusCode = response.res?.statusCode
    logger.info(
      {
        http: {
          response: {
            status_code: statusCode
          }
        },
        service: 'dynamics',
        operation: 'getAccessToken'
      },
      'Dynamics 365 access token request successful'
    )

    const responsePayload = JSON.parse(response.payload.toString('utf8'))

    if (!responsePayload.access_token) {
      throw Boom.badImplementation('No access_token in response')
    }

    return responsePayload.access_token
  } catch (error) {
    const statusCode =
      error.output?.statusCode ||
      error.response?.statusCode ||
      error.res?.statusCode
    logger.error(
      {
        error: {
          message: error.message || String(error),
          stack_trace: error.stack,
          type: error.name || error.constructor?.name || 'Error',
          code: error.code || error.statusCode
        },
        http: statusCode
          ? {
              response: {
                status_code: statusCode
              }
            }
          : undefined,
        service: 'dynamics',
        operation: 'getAccessToken'
      },
      'Dynamics 365 access token request failed'
    )
    throw Boom.badImplementation(`Dynamics token request failed`, error)
  }
}
