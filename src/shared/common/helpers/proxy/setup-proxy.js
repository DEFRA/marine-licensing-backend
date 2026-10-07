import Http from 'node:http'
import Https from 'node:https'
import Wreck from '@hapi/wreck'

import { createLogger } from '../logging/logger.js'
import { config } from '../../../../config.js'

const logger = createLogger()

function buildProxyEnv(proxyUrl) {
  return {
    ...process.env,
    HTTP_PROXY: proxyUrl,
    HTTPS_PROXY: process.env.HTTPS_PROXY || proxyUrl,
    http_proxy: proxyUrl,
    https_proxy: process.env.https_proxy || process.env.HTTPS_PROXY || proxyUrl
  }
}

/**
 * If HTTP_PROXY is set, setupProxy() enables it for Node's global agents
 * and Wreck. Do not rely on NODE_USE_ENV_PROXY alone — Wreck still needs
 * the agents below.
 */
export function setupProxy() {
  const proxyUrl = config.get('httpProxy')

  if (!proxyUrl) {
    return
  }

  logger.info('Routing outbound requests via proxy')

  const proxyEnv = buildProxyEnv(proxyUrl)

  // Configure Node's global agents (and fetch) for env-based proxying.
  if (typeof Http.setGlobalProxyFromEnv === 'function') {
    Http.setGlobalProxyFromEnv(proxyEnv)
  } else {
    Http.globalAgent = new Http.Agent({ proxyEnv })
    Https.globalAgent = new Https.Agent({ proxyEnv })
  }

  // Required for Wreck — it uses its own agents by default and bypasses the proxy
  Wreck.agents.http = Http.globalAgent
  Wreck.agents.https = Https.globalAgent
}
