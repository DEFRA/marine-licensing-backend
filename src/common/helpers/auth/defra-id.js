import Bell from '@hapi/bell'
import fetch from 'node-fetch'
import Jwt from '@hapi/jwt'
import { config } from '../../../config.js'
import { createLogger } from '../logging/logger.js'

const logger = createLogger()

const safeLog = {
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

export const defraId = {
  plugin: {
    name: 'defra-id',
    register: async (server) => {
      const oidcConfigurationUrl = config.get('defraIdOidcConfigurationUrl')

      safeLog.info(`OIDC configuration URL: ${oidcConfigurationUrl}`)
      safeLog.info(`Environment: ${process.env.NODE_ENV}`)
      safeLog.info(`CDP Environment: ${config.get('cdpEnvironment')}`)
      safeLog.info(
        `Secure Context Enabled: ${config.get('isSecureContextEnabled')}`
      )
      safeLog.info(`HTTP Proxy: ${config.get('httpProxy') || 'not configured'}`)

      if (process.env.NODE_ENV === 'test' || !oidcConfigurationUrl) {
        server.auth.default('dummy')
        return
      }
      const authCallbackUrl = config.get('redirectUri')

      await server.register(Bell)

      try {
        safeLog.info(`Fetching OIDC configuration from ${oidcConfigurationUrl}`)

        const fetchOptions = {}
        if (global.PROXY_AGENT) {
          fetchOptions.agent = global.PROXY_AGENT
          safeLog.info(
            `Using proxy agent for OIDC fetch: ${global.PROXY_AGENT.proxy ? global.PROXY_AGENT.proxy.toString() : 'unknown proxy type'}`
          )
        } else {
          safeLog.info(
            'No proxy agent available - OIDC requests will be made directly'
          )
        }

        // Add additional debugging for TLS issues
        safeLog.info('Attempting to fetch OIDC configuration...')

        try {
          const response = await fetch(oidcConfigurationUrl, fetchOptions)

          if (!response.ok) {
            throw new Error(
              `Failed to fetch OIDC config: ${response.status} ${response.statusText}`
            )
          }

          const oidcConf = await response.json()
          safeLog.info('Successfully fetched OIDC configuration')

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
        } catch (fetchError) {
          safeLog.error(`Fetch operation failed: ${fetchError.message}`)
          safeLog.error(`Fetch error name: ${fetchError.name}`)
          safeLog.error(`Fetch error code: ${fetchError.code}`)

          if (fetchError.cause) {
            safeLog.error(`Underlying error: ${fetchError.cause.message}`)
            safeLog.error(`Underlying error name: ${fetchError.cause.name}`)
            safeLog.error(`Underlying error code: ${fetchError.cause.code}`)
          }

          throw fetchError
        }
      } catch (error) {
        safeLog.error(`OIDC configuration error: ${error.message}`)
        safeLog.error(
          'Check if TLS certificates are properly configured or if a proxy is needed'
        )
        safeLog.error(`Error stack: ${error.stack}`)
        throw error
      }
    }
  }
}
