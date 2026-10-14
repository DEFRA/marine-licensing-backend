import Hapi from '@hapi/hapi'
import Boom from '@hapi/boom'
import joi from 'joi'
import { logResponseSchemaMismatch } from './log-response-schema-mismatch.js'

const countSchema = joi.object({ count: joi.number().required() })

describe('logResponseSchemaMismatch', () => {
  const logger = { warn: vi.fn() }
  let server

  beforeAll(async () => {
    server = Hapi.server()
    server.ext('onRequest', (request, h) => {
      request.logger = logger
      return h.continue
    })
    server.route([
      {
        method: 'GET',
        path: '/mismatch',
        options: {
          response: {
            status: { 200: countSchema },
            failAction: logResponseSchemaMismatch
          }
        },
        handler: () => ({ count: 'not-a-number' })
      },
      {
        method: 'GET',
        path: '/match',
        options: {
          response: {
            status: { 200: countSchema },
            failAction: logResponseSchemaMismatch
          }
        },
        handler: () => ({ count: 1 })
      },
      {
        method: 'GET',
        path: '/missing/{id}',
        options: {
          response: {
            status: { 404: joi.object({ statusCode: joi.string() }) },
            failAction: logResponseSchemaMismatch
          }
        },
        handler: () => {
          throw Boom.notFound('gone')
        }
      }
    ])
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop()
  })

  test('returns the original response when it does not match its schema', async () => {
    const { statusCode, result } = await server.inject('/mismatch')

    expect(statusCode).toBe(200)
    expect(result).toEqual({ count: 'not-a-number' })
  })

  test('logs the mismatch with ECS event fields', async () => {
    await server.inject('/mismatch')

    expect(logger.warn).toHaveBeenCalledWith(
      {
        event: {
          action: 'openapi:response-schema-mismatch',
          reference: 'GET /mismatch 200',
          reason: '"count" must be a number'
        }
      },
      'Response does not match its documented schema: GET /mismatch'
    )
  })

  test('does not log when the response matches its schema', async () => {
    await server.inject('/match')

    expect(logger.warn).not.toHaveBeenCalled()
  })

  test('keeps an error response and reports its status code', async () => {
    const { statusCode } = await server.inject('/missing/1')

    expect(statusCode).toBe(404)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ reference: 'GET /missing/{id} 404' })
      }),
      'Response does not match its documented schema: GET /missing/{id}'
    )
  })
})
