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

      logger.info('Setting up undici ProxyAgent...')
      setGlobalDispatcher(new ProxyAgent(proxyUrl))
      logger.info('Undici ProxyAgent setup completed')

      logger.info('Setting up global-agent...')
      bootstrap()
      global.GLOBAL_AGENT.HTTP_PROXY = proxyUrl
      global.GLOBAL_AGENT.HTTPS_PROXY = proxyUrl
      global.GLOBAL_AGENT.NO_PROXY =
        process.env.NO_PROXY || 'localhost,127.0.0.1'
      logger.info('global-agent setup completed')

      logger.info('Setting up HttpsProxyAgent for node-fetch...')
      global.PROXY_AGENT = new HttpsProxyAgent(proxyUrl)
      logger.info('HttpsProxyAgent setup completed')

      logger.info('Proxy setup completed successfully')
    } catch (error) {
      logger.error(`Error setting up proxy: ${error.message}`)
      logger.error(`Error name: ${error.name}`)
      logger.error(`Error code: ${error.code || 'no error code'}`)
      logger.error(`Error stack: ${error.stack}`)

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
