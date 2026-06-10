import { Agent, ProxyAgent, fetch } from 'undici'
import { config } from '../../../config.js'

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

export class RetryAfterError extends Error {
  constructor(message, { retryAfterSeconds, statusCode }) {
    super(message)
    this.name = 'RetryAfterError'
    this.retryAfterSeconds = retryAfterSeconds
    this.statusCode = statusCode
  }
}

export const parseRetryAfterSeconds = (headerValue) => {
  if (!headerValue) {
    return null
  }
  const seconds = Number(headerValue)
  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.round(seconds))
  }
  const retryAt = Date.parse(headerValue)
  if (!Number.isNaN(retryAt)) {
    return Math.max(0, Math.round((retryAt - Date.now()) / 1000))
  }
  return null
}

const nanosecondsPerMillisecond = 1_000_000

/**
 * Fetches JSON from an upstream with the policy-calculation HTTP rules:
 * bounded by an AbortSignal timeout, identified by the configured User-Agent,
 * connection closed after the request, and the call duration logged at INFO
 * under a unique ECS event action on both success and failure. 429/503
 * responses with a Retry-After hint throw RetryAfterError so the worker can
 * extend the queue's redelivery timer.
 */
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
        'user-agent': config.get('policies').userAgent,
        accept: 'application/json',
        ...options.headers
      }
    })

    if (response.status === 429 || response.status === 503) {
      const retryAfterSeconds = parseRetryAfterSeconds(
        response.headers.get('retry-after')
      )
      throw new RetryAfterError(
        `${upstreamName} responded with status ${response.status}`,
        { retryAfterSeconds, statusCode: response.status }
      )
    }

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
