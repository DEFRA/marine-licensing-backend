import { vi } from 'vitest'
import {
  timedJsonFetch,
  parseRetryAfterSeconds,
  RetryAfterError,
  getPoliciesDispatcher,
  resetPoliciesDispatcher
} from './policies-http.js'

let fetchMock

beforeEach(() => {
  fetchMock = globalThis.fetchMock
})

describe('parseRetryAfterSeconds', () => {
  it('should return null when the header is missing', () => {
    expect(parseRetryAfterSeconds(null)).toBeNull()
    expect(parseRetryAfterSeconds('')).toBeNull()
  })

  it('should parse a delay in seconds', () => {
    expect(parseRetryAfterSeconds('30')).toBe(30)
  })

  it('should clamp negative delays to zero', () => {
    expect(parseRetryAfterSeconds('-5')).toBe(0)
  })

  it('should parse an HTTP-date relative to now', () => {
    const inThirtySeconds = new Date(Date.now() + 30_000).toUTCString()
    const seconds = parseRetryAfterSeconds(inThirtySeconds)
    expect(seconds).toBeGreaterThanOrEqual(28)
    expect(seconds).toBeLessThanOrEqual(31)
  })

  it('should return null for garbage values', () => {
    expect(parseRetryAfterSeconds('not-a-date')).toBeNull()
  })
})

describe('getPoliciesDispatcher', () => {
  it('should return a singleton dispatcher', () => {
    resetPoliciesDispatcher()
    const dispatcher = getPoliciesDispatcher()
    expect(dispatcher).toBe(getPoliciesDispatcher())
    expect(dispatcher).toBeDefined()
  })
})

describe('timedJsonFetch', () => {
  const setupLogger = () => ({ info: vi.fn(), error: vi.fn() })

  const callOptions = (logger, overrides = {}) => ({
    url: 'https://upstream.example/query',
    timeoutMs: 1000,
    eventAction: 'mp-policies:arcgis-query',
    upstreamName: 'Test upstream',
    logger,
    ...overrides
  })

  it('should return parsed JSON and log success duration under the event action', async () => {
    const logger = setupLogger()
    fetchMock.mockResponseOnce(JSON.stringify({ features: [] }))

    const json = await timedJsonFetch(callOptions(logger))

    expect(json).toEqual({ features: [] })
    expect(logger.info).toHaveBeenCalledWith(
      {
        event: expect.objectContaining({
          action: 'mp-policies:arcgis-query',
          outcome: 'success',
          duration: expect.any(Number)
        })
      },
      expect.stringContaining('Test upstream completed in')
    )
  })

  it('should send the configured User-Agent and a bounded AbortSignal', async () => {
    const logger = setupLogger()
    fetchMock.mockResponseOnce('{}')

    await timedJsonFetch(callOptions(logger))

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers['user-agent']).toBe('marine-licensing-backend/1.0')
    expect(options.signal).toBeInstanceOf(AbortSignal)
  })

  it('should throw RetryAfterError on 429 with a Retry-After header', async () => {
    const logger = setupLogger()
    fetchMock.mockResponseOnce('', {
      status: 429,
      headers: { 'retry-after': '30' }
    })

    const error = await timedJsonFetch(callOptions(logger)).catch((e) => e)

    expect(error).toBeInstanceOf(RetryAfterError)
    expect(error.retryAfterSeconds).toBe(30)
    expect(error.statusCode).toBe(429)
  })

  it('should throw RetryAfterError on 503', async () => {
    const logger = setupLogger()
    fetchMock.mockResponseOnce('', { status: 503 })

    const error = await timedJsonFetch(callOptions(logger)).catch((e) => e)

    expect(error).toBeInstanceOf(RetryAfterError)
    expect(error.retryAfterSeconds).toBeNull()
  })

  it('should throw and log failure duration on other error statuses', async () => {
    const logger = setupLogger()
    fetchMock.mockResponseOnce('', { status: 500 })

    const error = await timedJsonFetch(callOptions(logger)).catch((e) => e)

    expect(error.message).toContain('responded with status 500')
    expect(error.statusCode).toBe(500)
    expect(logger.info).toHaveBeenCalledWith(
      {
        event: expect.objectContaining({
          action: 'mp-policies:arcgis-query',
          outcome: 'failure',
          duration: expect.any(Number)
        })
      },
      expect.stringContaining('Test upstream failed after')
    )
  })

  it('should log failure duration when the request itself rejects', async () => {
    const logger = setupLogger()
    fetchMock.mockRejectOnce(new Error('socket hang up'))

    await expect(timedJsonFetch(callOptions(logger))).rejects.toThrow(
      'socket hang up'
    )
    expect(logger.info).toHaveBeenCalledWith(
      {
        event: expect.objectContaining({ outcome: 'failure' })
      },
      expect.stringContaining('socket hang up')
    )
  })
})
