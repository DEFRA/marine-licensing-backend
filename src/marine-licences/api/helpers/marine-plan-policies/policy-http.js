import { Agent, ProxyAgent, fetch } from 'undici'
import { config } from '../../../../config.js'

// pipelining: 0 makes undici close the socket after each request instead of
// holding a keep-alive slot on the upstream (a `Connection: close` header is a
// forbidden fetch header and would be ignored).
const connectionCloseOptions = { pipelining: 0 }

let dispatcherInstance = null

export const getPoliciesDispatcher = () => {
  if (!dispatcherInstance) {
    const proxyUrl = config.get('httpProxy')
    dispatcherInstance = proxyUrl
      ? new ProxyAgent({ uri: proxyUrl, ...connectionCloseOptions })
      : new Agent(connectionCloseOptions)
  }
  return dispatcherInstance
}

export const resetPoliciesDispatcher = () => {
  dispatcherInstance = null
}

const nanosecondsPerMillisecond = 1_000_000

export const timedJsonFetch = async ({
  url,
  options = {},
  timeoutMs,
  eventAction,
  upstreamName,
  logger
}) => {
  const startedAt = process.hrtime.bigint()
  const durationNs = () => Number(process.hrtime.bigint() - startedAt)
  const durationMs = () => Math.round(durationNs() / nanosecondsPerMillisecond)

  try {
    const response = await fetch(url, {
      ...options,
      dispatcher: getPoliciesDispatcher(),
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'user-agent': config.get('marinePlanPolicies').userAgent,
        accept: 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = new Error(
        `${upstreamName} responded with status ${response.status}`
      )
      error.statusCode = response.status
      throw error
    }

    const json = await response.json()
    logger.info(
      {
        event: {
          action: eventAction,
          outcome: 'success',
          duration: durationNs()
        }
      },
      `${upstreamName} completed in ${durationMs()}ms`
    )
    return json
  } catch (error) {
    logger.info(
      {
        event: {
          action: eventAction,
          outcome: 'failure',
          duration: durationNs()
        }
      },
      `${upstreamName} failed after ${durationMs()}ms: ${error.message}`
    )
    throw error
  }
}
