import { ProxyAgent, setGlobalDispatcher } from 'undici'
import { bootstrap } from 'global-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'

import { createLogger } from '../logging/logger.js'
import { config } from '../../../config.js'

export const logger = createLogger()

function safeWarn(loggerInstance, message) {
  if (loggerInstance && typeof loggerInstance.warn === 'function') {
    loggerInstance.warn(message)
  } else if (loggerInstance && typeof loggerInstance.info === 'function') {
    loggerInstance.info(`WARN: ${message}`)
  } else {
    // No logging available
  }
}

export function setupProxy() {
  const proxyUrl = config.get('httpProxy')

  if (proxyUrl) {
    try {
      logger.info(`Setting up global proxies with ${proxyUrl}`)
      logger.info(`Current environment: ${process.env.NODE_ENV}`)
      logger.info(`CDP environment: ${config.get('cdpEnvironment')}`)
      logger.info(
        `Secure context enabled: ${config.get('isSecureContextEnabled')}`
      )

      const tlsEnvVars = Object.keys(process.env)
        .filter(
          (key) =>
            key.startsWith('TRUSTSTORE_') || key === 'ENABLE_SECURE_CONTEXT'
        )
        .map((key) => key)

      logger.info(
        `TLS-related environment variables found: ${tlsEnvVars.join(', ') || 'none'}`
      )

      logger.info('Setting up undici ProxyAgent...')
      const proxyAgentOptions = {
        requestTls: {
          rejectUnauthorized: false
        },
        proxyTls: {
          rejectUnauthorized: false
        }
      }

      setGlobalDispatcher(new ProxyAgent(proxyUrl, proxyAgentOptions))
      logger.info('Undici ProxyAgent setup completed with custom TLS options')

      logger.info('Setting up global-agent...')
      bootstrap()
      global.GLOBAL_AGENT.HTTP_PROXY = proxyUrl
      global.GLOBAL_AGENT.HTTPS_PROXY = proxyUrl
      global.GLOBAL_AGENT.NO_PROXY =
        process.env.NO_PROXY || 'localhost,127.0.0.1'
      logger.info('global-agent setup completed')

      logger.info('Setting up HttpsProxyAgent for node-fetch...')
      const httpsProxyOptions = {
        rejectUnauthorized: false
      }

      global.PROXY_AGENT = new HttpsProxyAgent(proxyUrl, httpsProxyOptions)
      logger.info('HttpsProxyAgent setup completed with custom TLS options')

      logger.info('Proxy setup completed successfully')
    } catch (error) {
      logger.error(`Error setting up proxy: ${error.message}`)
      logger.error(`Error name: ${error.name}`)
      logger.error(`Error code: ${error.code || 'no error code'}`)
      logger.error(`Error stack: ${error.stack}`)

      if (
        error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED' ||
        error.message.includes('TLS') ||
        error.message.includes('certificate')
      ) {
        logger.error('This appears to be a TLS/certificate validation issue.')
        logger.error('Please check:')
        logger.error('1. Your proxy configuration can access the target URL')
        logger.error('2. Your certificates are in the correct PEM format')
        logger.error('3. Your ENABLE_SECURE_CONTEXT setting is correct')
      }

      safeWarn(
        logger,
        'Continuing application startup despite proxy setup failure'
      )
    }
  } else {
    logger.info(
      'No HTTP_PROXY environment variable found, skipping proxy setup'
    )
  }
}
