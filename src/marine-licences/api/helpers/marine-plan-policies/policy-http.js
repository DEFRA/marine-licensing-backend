import Wreck from '@hapi/wreck'
import { config } from '../../../../config.js'

const nanosecondsPerMillisecond = 1_000_000

export const timedJsonFetch = async ({
  url,
  options = {},
  timeoutMs,
  maxBytes,
  eventAction,
  upstreamName,
  logger,
  reference
}) => {
  const startedAt = process.hrtime.bigint()
  const durationNs = () => Number(process.hrtime.bigint() - startedAt)
  const durationMs = () => Math.round(durationNs() / nanosecondsPerMillisecond)

  try {
    const method = options.method ?? 'GET'
    const wreckOptions = {
      headers: {
        'user-agent': config.get('marinePlanPolicies').userAgent,
        accept: 'application/json',
        ...options.headers
      },
      payload: options.body,
      timeout: timeoutMs,
      ...(maxBytes && { maxBytes }),
      json: true
    }
    const { payload } = await (method === 'POST'
      ? Wreck.post(url, wreckOptions)
      : Wreck.get(url, wreckOptions))

    logger.info(
      {
        event: {
          action: eventAction,
          outcome: 'success',
          duration: durationNs(),
          ...(reference && { reference })
        }
      },
      `${upstreamName} completed in ${durationMs()}ms`
    )
    return payload
  } catch (error) {
    logger.warn(
      {
        event: {
          action: eventAction,
          outcome: 'failure',
          duration: durationNs(),
          ...(reference && { reference })
        }
      },
      `${upstreamName} failed after ${durationMs()}ms: ${error.message}`
    )
    throw error
  }
}
