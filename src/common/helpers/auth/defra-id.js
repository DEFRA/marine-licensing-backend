import Bell from '@hapi/bell'
import Wreck from '@hapi/wreck'
import Jwt from '@hapi/jwt'
import { config } from '../../../config.js'
import { createLogger } from '../logging/logger.js'

export const logger = createLogger()

const HTTP_BAD_REQUEST = 400

export const safeLog = {
  info: (message) => {
    if (logger && typeof logger.info === 'function') {
      logger.info(message)
    }
  },
  error: (message) => {
    if (logger && typeof logger.error === 'function') {
      logger.error(message)
    }
  }
}

export async function fetchOidcConfig(oidcConfigurationUrl) {
  safeLog.info(`Fetching OIDC configuration from ${oidcConfigurationUrl}`)

  try {
    const { res, payload } = await Wreck.get(oidcConfigurationUrl)

    if (res.statusCode >= HTTP_BAD_REQUEST) {
      throw new Error(
        `Failed to fetch OIDC config: ${res.statusCode} ${res.statusMessage}`
      )
    }

    const oidcConf = JSON.parse(payload.toString())
    safeLog.info('Successfully fetched OIDC configuration')
    return oidcConf
  } catch (error) {
    if (error.isBoom) {
      throw new Error(`Failed to fetch OIDC config: ${error.message}`)
    }
    throw error
  }
}

export function setupAuthStrategy(server, oidcConf, authCallbackUrl) {
  server.auth.strategy('defra-id', 'bell', {
    location: (request) => {
      if (request.info.referrer) {
        request.yar.flash('referrer', request.info.referrer)
      }
      return authCallbackUrl
    },
    provider: {
      name: 'defra-id',
      protocol: 'oauth2',
      useParamsAuth: true,
      auth: oidcConf.authorization_endpoint,
      token: oidcConf.token_endpoint,
      scope: ['openid', 'offline_access'],
      profile: (credentials, params) => {
        const {
          decoded: { payload }
        } = Jwt.token.decode(credentials.token)
        credentials.profile = {
          id: payload.sub,
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          roles: payload.roles,
          relationships: payload.relationships,
          rawIdToken: params.id_token,
          logoutUrl: oidcConf.end_session_endpoint
        }
      }
    },
    clientId: config.get('defraIdClientId'),
    clientSecret: config.get('defraIdClientSecret'),
    cookie: 'bell-defra-id',
    password: config.get('defraIdCookiePassword'),
    isSecure: false,
    providerParams: {
      serviceId: config.get('defraIdServiceId')
    }
  })

  server.auth.default('defra-id')
}

export async function setupDefraIdAuth(
  server,
  oidcConfigurationUrl,
  authCallbackUrl
) {
  try {
    const oidcConf = await fetchOidcConfig(oidcConfigurationUrl)
    setupAuthStrategy(server, oidcConf, authCallbackUrl)
  } catch (fetchError) {
    safeLog.error(`OIDC configuration error: ${fetchError.message}`)
    throw fetchError
  }
}

export async function debugHttpClients(oidcConfigurationUrl) {
  safeLog.info('=== DEBUG: Testing HTTP clients during startup ===')

  try {
    safeLog.info(`DEBUG: Testing basic Wreck GET to ${oidcConfigurationUrl}`)
    const { res, payload } = await Wreck.get(oidcConfigurationUrl, {
      timeout: 5000
    })
    safeLog.info(`DEBUG: Basic Wreck success - Status: ${res.statusCode}`)
    const oidcConfig = JSON.parse(payload.toString())
    safeLog.info(
      `DEBUG: OIDC config retrieved - Issuer: ${oidcConfig.issuer || 'unknown'}`
    )
  } catch (error) {
    safeLog.error(`DEBUG: Basic Wreck failed - ${error.message}`)
    safeLog.error(
      `DEBUG: Error name: ${error.name}, code: ${error.code || 'none'}`
    )
    if (error.isBoom) {
      safeLog.error(`DEBUG: Boom error output: ${JSON.stringify(error.output)}`)
    }
  }

  safeLog.info('=== DEBUG: HTTP client testing complete ===')
}

export const defraId = {
  plugin: {
    name: 'defra-id',
    register: async (server) => {
      const oidcConfigurationUrl = config.get('defraIdOidcConfigurationUrl')

      safeLog.info(`OIDC configuration URL: ${oidcConfigurationUrl}`)
      safeLog.info(`Environment: ${process.env.NODE_ENV}`)

      if (process.env.NODE_ENV === 'test' || !oidcConfigurationUrl) {
        server.auth.default('dummy')
        return
      }

      const authCallbackUrl = config.get('redirectUri')
      await server.register(Bell)

      // Debug HTTP clients if requested
      if (process.env.DEBUG_HTTP_CLIENTS === 'true') {
        try {
          await debugHttpClients(oidcConfigurationUrl)
        } catch (debugError) {
          safeLog.error(
            `DEBUG: HTTP client testing failed: ${debugError.message}`
          )
        }
      }

      try {
        await setupDefraIdAuth(server, oidcConfigurationUrl, authCallbackUrl)
        safeLog.info('✅ OIDC authentication setup completed successfully')
      } catch (error) {
        safeLog.error(`OIDC configuration failed: ${error.message}`)

        // Allow continuing on error if debug flag is set
        if (process.env.DEBUG_CONTINUE_ON_ERROR === 'true') {
          safeLog.info(
            'DEBUG: Continuing despite OIDC error due to DEBUG_CONTINUE_ON_ERROR=true'
          )
          server.auth.default('dummy')
          return
        }

        throw error
      }
    }
  }
}
