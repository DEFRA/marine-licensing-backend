import { vi } from 'vitest'
import Wreck from '@hapi/wreck'
import Boom from '@hapi/boom'
import { timedJsonFetch } from './policy-http.js'

vi.mock('@hapi/wreck')

describe('timedJsonFetch', () => {
  const setupLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })

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
    Wreck.get.mockResolvedValue({
      res: { statusCode: 200 },
      payload: { features: [] }
    })

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

  it('should send the configured User-Agent and timeout', async () => {
    const logger = setupLogger()
    Wreck.get.mockResolvedValue({ res: { statusCode: 200 }, payload: {} })

    await timedJsonFetch(callOptions(logger))

    const [, options] = Wreck.get.mock.calls[0]
    expect(options.headers['user-agent']).toBe(
      'Defra / MMO / Get permission for marine work'
    )
    expect(options.timeout).toBe(1000)
  })

  it('should throw and log failure duration on error statuses', async () => {
    const logger = setupLogger()
    Wreck.get.mockRejectedValue(Boom.internal('Internal Server Error'))

    await expect(timedJsonFetch(callOptions(logger))).rejects.toThrow(
      'Internal Server Error'
    )
    expect(logger.warn).toHaveBeenCalledWith(
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
    Wreck.get.mockRejectedValue(new Error('socket hang up'))

    await expect(timedJsonFetch(callOptions(logger))).rejects.toThrow(
      'socket hang up'
    )
    expect(logger.warn).toHaveBeenCalledWith(
      {
        event: expect.objectContaining({ outcome: 'failure' })
      },
      expect.stringContaining('socket hang up')
    )
  })

  it('should use Wreck.post when method is POST', async () => {
    const logger = setupLogger()
    Wreck.post.mockResolvedValue({ res: { statusCode: 200 }, payload: {} })

    await timedJsonFetch(
      callOptions(logger, { options: { method: 'POST', body: 'data=1' } })
    )

    expect(Wreck.post).toHaveBeenCalledTimes(1)
    expect(Wreck.get).not.toHaveBeenCalled()
    const [, options] = Wreck.post.mock.calls[0]
    expect(options.payload).toBe('data=1')
  })
})
