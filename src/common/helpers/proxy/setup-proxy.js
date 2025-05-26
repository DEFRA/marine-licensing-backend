import { ProxyAgent, setGlobalDispatcher } from 'undici'
import { bootstrap } from 'global-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'

import { createLogger } from '../logging/logger.js'
import { config } from '../../../config.js'

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
  },
  warn: (message) => {
    if (logger && typeof logger.warn === 'function') {
      logger.warn(message)
    } else if (logger && typeof logger.info === 'function') {
      logger.info(`WARN: ${message}`)
    }
  }
}

const TLS_ERROR_CODES = [
  'ECONNRESET',
  'CERT_HAS_EXPIRED',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'CERT_SIGNATURE_FAILURE'
]

export function isTlsError(error) {
  if (!error) return false

  if (error.code && TLS_ERROR_CODES.includes(error.code)) {
    return true
  }

  const errorMessage = error.message ? error.message.toLowerCase() : ''
  return (
    errorMessage.includes('tls') ||
    errorMessage.includes('certificate') ||
    errorMessage.includes('ssl') ||
    errorMessage.includes('handshake') ||
    errorMessage.includes('self signed') ||
    errorMessage.includes('verification')
  )
}

export function setupProxy() {
  try {
    const proxyUrl = config.get('httpProxy')

    if (!proxyUrl) {
      safeLog.info(
        'No HTTP_PROXY environment variable found, skipping proxy setup'
      )
      return
    }

    const tlsEnvVars = Object.keys(process.env).filter(
      (key) =>
        key.startsWith('TRUSTSTORE_') ||
        key.startsWith('NODE_TLS_') ||
        key === 'ENABLE_SECURE_CONTEXT'
    )

    if (tlsEnvVars.length > 0) {
      safeLog.info(`TLS environment variables found: ${tlsEnvVars.join(', ')}`)
    } else {
      safeLog.warn(
        'No TLS environment variables found, which may cause certificate validation issues'
      )
    }

    const isSecureContextEnabled = config.get('isSecureContextEnabled')
    const cdpEnvironment = config.get('cdpEnvironment') || 'unknown'

    safeLog.info(`Setting up proxy with URL: ${proxyUrl}`)
    safeLog.info(`CDP Environment: ${cdpEnvironment}`)
    safeLog.info(`Secure context enabled: ${isSecureContextEnabled}`)

    safeLog.info('Setting up ProxyAgent for undici...')
    const agent = new ProxyAgent(proxyUrl, {
      requestTls: {
        rejectUnauthorized: isSecureContextEnabled !== false
      }
    })
    setGlobalDispatcher(agent)
    safeLog.info('undici dispatcher configured with proxy')

    safeLog.info('Setting up global-agent...')
    bootstrap()

    global.GLOBAL_AGENT.HTTP_PROXY = proxyUrl
    global.GLOBAL_AGENT.HTTPS_PROXY = proxyUrl

    global.GLOBAL_AGENT.NO_PROXY = process.env.NO_PROXY || 'localhost,127.0.0.1'
    safeLog.info('global-agent setup completed')

    safeLog.info('Setting up HttpsProxyAgent for node-fetch...')

    const tlsOptions = {
      rejectUnauthorized: isSecureContextEnabled !== false
    }

    if (cdpEnvironment === 'test' || cdpEnvironment === 'staging') {
      safeLog.info(
        `Using relaxed TLS options for ${cdpEnvironment} environment`
      )

      if (!isSecureContextEnabled) {
        tlsOptions.rejectUnauthorized = false
        safeLog.warn(
          'TLS certificate validation is DISABLED. This is not recommended for production.'
        )
      }
    }

    global.PROXY_AGENT = new HttpsProxyAgent(proxyUrl, tlsOptions)
    safeLog.info('HttpsProxyAgent setup completed with custom TLS options')

    return global.PROXY_AGENT
  } catch (error) {
    safeLog.error(`Error setting up proxy: ${error.message}`)
    safeLog.error(`Error name: ${error.name}`)
    safeLog.error(`Error code: ${error.code || 'No error code'}`)
    safeLog.error(`Error stack: ${error.stack}`)

    if (isTlsError(error)) {
      safeLog.error('This appears to be a TLS/certificate validation issue.')
      safeLog.error('Please check:')
      safeLog.error('1. Your proxy configuration can access the target URL')
      safeLog.error('2. Your certificates are in the correct PEM format')
      safeLog.error('3. Your ENABLE_SECURE_CONTEXT setting is correct')
      safeLog.error(
        '4. Set NODE_TLS_REJECT_UNAUTHORIZED=0 temporarily to bypass validation'
      )
      safeLog.error('5. Check if your proxy requires additional authentication')
    }

    safeLog.warn('Continuing application startup despite proxy setup failure')
  }
}
