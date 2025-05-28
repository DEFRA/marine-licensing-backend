import Bell from '@hapi/bell'
import Wreck from '@hapi/wreck'
import Jwt from '@hapi/jwt'
import { config } from '../../../config.js'
import { createLogger } from '../logging/logger.js'

export const logger = createLogger()

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

  const wreckOptions = {}
  if (global.PROXY_AGENT) {
    wreckOptions.agent = global.PROXY_AGENT
    safeLog.info(
      `Using proxy agent for OIDC fetch: ${global.PROXY_AGENT.proxy ? global.PROXY_AGENT.proxy.toString() : 'unknown proxy type'}`
    )
  } else {
    safeLog.info(
      'No proxy agent available - OIDC requests will be made directly'
    )
  }

  safeLog.info('Attempting to fetch OIDC configuration...')

  try {
    const { res, payload } = await Wreck.get(oidcConfigurationUrl, wreckOptions)

    if (res.statusCode >= 400) {
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

function logTlsRecommendations() {
  safeLog.error(
    'TLS ISSUE DETECTED: This appears to be a TLS handshake problem'
  )
  safeLog.error('Recommended solutions:')
  safeLog.error(
    '1. Verify your TRUSTSTORE certificates are correctly formatted'
  )
  safeLog.error('2. Check that ENABLE_SECURE_CONTEXT is set to true')
  safeLog.error('3. Ensure your proxy can access the OIDC endpoint')
  safeLog.error('4. Verify there are no firewall rules blocking the connection')
}

function logRequestErrorDetails(requestError) {
  if (requestError.isBoom) {
    safeLog.error(`Boom error output: ${JSON.stringify(requestError.output)}`)
    safeLog.error(`Boom error data: ${JSON.stringify(requestError.data)}`)
  }

  if (requestError.message && requestError.message.includes('TLS')) {
    logTlsRecommendations()
  }
}

export function logRequestError(requestError) {
  safeLog.error(`Request operation failed: ${requestError.message}`)
  safeLog.error(`Request error name: ${requestError.name}`)
  safeLog.error(`Request error code: ${requestError.code || 'no error code'}`)

  if (requestError.isBoom || requestError.name === 'RequestError') {
    logRequestErrorDetails(requestError)
  }

  if (requestError.cause) {
    logUnderlyingError(requestError.cause)
  }

  safeLog.error(
    `Error stack: ${requestError.stack || 'No stack trace available'}`
  )
}

function logUnderlyingError(cause) {
  safeLog.error(`Underlying error: ${cause.message}`)
  safeLog.error(`Underlying error name: ${cause.name}`)
  safeLog.error(`Underlying error code: ${cause.code || 'no code'}`)

  if (cause.stack) {
    safeLog.error(`Underlying error stack: ${cause.stack}`)
  }
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
    logRequestError(fetchError)
    throw fetchError
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

      const tlsEnvVars = Object.keys(process.env)
        .filter(
          (key) =>
            key.startsWith('TRUSTSTORE_') || key === 'ENABLE_SECURE_CONTEXT'
        )
        .map((key) => key)

      safeLog.info(
        `TLS-related environment variables found: ${tlsEnvVars.join(', ') || 'none'}`
      )

      if (process.env.NODE_ENV === 'test' || !oidcConfigurationUrl) {
        server.auth.default('dummy')
        return
      }

      const authCallbackUrl = config.get('redirectUri')
      await server.register(Bell)

      try {
        await setupDefraIdAuth(server, oidcConfigurationUrl, authCallbackUrl)
      } catch (error) {
        safeLog.error(`OIDC configuration error: ${error.message}`)
        safeLog.error(
          'Check if TLS certificates are properly configured or if a proxy is needed'
        )

        safeLog.error('CONFIGURATION CHECKLIST:')
        safeLog.error('1. HTTP_PROXY and HTTPS_PROXY are set (if needed)')
        safeLog.error('2. ENABLE_SECURE_CONTEXT is set to true')
        safeLog.error(
          '3. TRUSTSTORE_1 (and others if needed) contain valid PEM certificates'
        )
        safeLog.error('4. NO_PROXY does not include the OIDC endpoint domain')

        throw error
      }
    }
  }
}
