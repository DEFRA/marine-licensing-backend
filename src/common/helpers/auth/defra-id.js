import Bell from '@hapi/bell'
import fetch from 'node-fetch'
import Jwt from '@hapi/jwt'
import { config } from '../../../config.js'
import { createLogger } from '../logging/logger.js'

export const logger = createLogger()

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

async function fetchOidcConfig(oidcConfigurationUrl) {
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

  safeLog.info('Attempting to fetch OIDC configuration...')

  const response = await fetch(oidcConfigurationUrl, fetchOptions)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch OIDC config: ${response.status} ${response.statusText}`
    )
  }

  const oidcConf = await response.json()
  safeLog.info('Successfully fetched OIDC configuration')
  return oidcConf
}

function setupAuthStrategy(server, oidcConf, authCallbackUrl) {
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

function logFetchError(fetchError) {
  safeLog.error(`Fetch operation failed: ${fetchError.message}`)
  safeLog.error(`Fetch error name: ${fetchError.name}`)
  safeLog.error(`Fetch error code: ${fetchError.code || 'no error code'}`)

  // Log more detailed information for specific errors
  if (fetchError.name === 'FetchError') {
    safeLog.error(`FetchError type: ${fetchError.type || 'unknown'}`)
    safeLog.error(`FetchError errno: ${fetchError.errno || 'none'}`)
    safeLog.error(`FetchError input: ${fetchError.input || 'none'}`)

    if (fetchError.message.includes('TLS')) {
      safeLog.error(
        'TLS ISSUE DETECTED: This appears to be a TLS handshake problem'
      )
      safeLog.error('Recommended solutions:')
      safeLog.error(
        '1. Verify your TRUSTSTORE certificates are correctly formatted'
      )
      safeLog.error('2. Check that ENABLE_SECURE_CONTEXT is set to true')
      safeLog.error('3. Ensure your proxy can access the OIDC endpoint')
      safeLog.error(
        '4. Verify there are no firewall rules blocking the connection'
      )
    }
  }

  if (fetchError.cause) {
    safeLog.error(`Underlying error: ${fetchError.cause.message}`)
    safeLog.error(`Underlying error name: ${fetchError.cause.name}`)
    safeLog.error(
      `Underlying error code: ${fetchError.cause.code || 'no code'}`
    )

    // Log more details about the cause if available
    if (fetchError.cause.stack) {
      safeLog.error(`Underlying error stack: ${fetchError.cause.stack}`)
    }
  }

  // Always log the stack trace for the main error
  safeLog.error(
    `Error stack: ${fetchError.stack || 'No stack trace available'}`
  )
}

async function setupDefraIdAuth(server, oidcConfigurationUrl, authCallbackUrl) {
  try {
    const oidcConf = await fetchOidcConfig(oidcConfigurationUrl)
    setupAuthStrategy(server, oidcConf, authCallbackUrl)
  } catch (fetchError) {
    logFetchError(fetchError)
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

      // Log all TLS-related environment variables
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

        // Log an explicit summary of the key configuration needed
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
