import { ProxyAgent, setGlobalDispatcher } from 'undici'
import { bootstrap } from 'global-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'

import { createLogger } from '../logging/logger.js'
import { config } from '../../../config.js'

const logger = createLogger()

/**
 * If HTTP_PROXY is set setupProxy() will enable it globally
 * for a number of http clients.
 * Node Fetch will still need to pass a ProxyAgent in on each call.
 */
export function setupProxy() {
  const proxyUrl = config.get('httpProxy')

  if (proxyUrl) {
    try {
      logger.info(`Setting up global proxies with ${proxyUrl}`)

      setGlobalDispatcher(new ProxyAgent(proxyUrl))

      bootstrap()
      global.GLOBAL_AGENT.HTTP_PROXY = proxyUrl
      global.GLOBAL_AGENT.HTTPS_PROXY = proxyUrl
      global.GLOBAL_AGENT.NO_PROXY =
        process.env.NO_PROXY || 'localhost,127.0.0.1'

      global.PROXY_AGENT = new HttpsProxyAgent(proxyUrl)

      logger.info('Proxy setup completed successfully')
    } catch (error) {
      logger.error(`Error setting up proxy: ${error.message}`)
    }
  } else {
    logger.info(
      'No HTTP_PROXY environment variable found, skipping proxy setup'
    )
  }
}
