import { vi } from 'vitest'
import {
  timedJsonFetch,
  getPoliciesDispatcher,
  resetPoliciesDispatcher
} from './policy-http.js'

let fetchMock

beforeEach(() => {
  fetchMock = globalThis.fetchMock
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

  it('should throw and log failure duration on error statuses', async () => {
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
