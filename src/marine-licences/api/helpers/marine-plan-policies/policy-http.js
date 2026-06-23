import Wreck from '@hapi/wreck'
import { StatusCodes } from 'http-status-codes'
import { config } from '../../../../config.js'

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
    const method = options.method ?? 'GET'
    const wreckOptions = {
      headers: {
        'user-agent': config.get('marinePlanPolicies').userAgent,
        accept: 'application/json',
        ...options.headers
      },
      payload: options.body,
      timeout: timeoutMs,
      json: true
    }
    const { res, payload } = await (method === 'POST'
      ? Wreck.post(url, wreckOptions)
      : Wreck.get(url, wreckOptions))

    if (
      res.statusCode < StatusCodes.OK ||
      res.statusCode >= StatusCodes.MULTIPLE_CHOICES
    ) {
      const error = new Error(
        `${upstreamName} responded with status ${res.statusCode}`
      )
      error.statusCode = res.statusCode
      throw error
    }

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
    return payload
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
