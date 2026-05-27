import { describe, expect, test, vi, beforeEach } from 'vitest'
import { getIatContextController } from './get-iat-context.js'

describe('getIatContextController', () => {
  let findOne, db, request
  const validSlug = 'a'.repeat(22)

  beforeEach(() => {
    findOne = vi.fn()
    db = { collection: vi.fn(() => ({ findOne })) }
    request = {
      db,
      params: { slug: validSlug },
      logger: { error: vi.fn() }
    }
  })

  test('returns the context doc with _id stripped when found', async () => {
    const doc = {
      _id: 'mongo-object-id',
      slug: validSlug,
      questionLog: [{ questionRoute: '/q1' }]
    }
    findOne.mockResolvedValue(doc)
    await getIatContextController.handler(request, global.mockHandler)
    expect(db.collection).toHaveBeenCalledWith('iat-contexts')
    expect(global.mockHandler.response).toHaveBeenCalledWith({
      message: 'success',
      value: { slug: validSlug, questionLog: [{ questionRoute: '/q1' }] }
    })
    const { value } = global.mockHandler.response.mock.calls[0][0]
    expect(value).not.toHaveProperty('_id')
  })

  test('404 when slug unknown / TTL-expired', async () => {
    findOne.mockResolvedValue(null)
    await expect(
      getIatContextController.handler(request, global.mockHandler)
    ).rejects.toThrow('IAT context not found or expired')
  })

  test('re-throws Boom errors without wrapping (preserves 4xx statusCodes)', async () => {
    const boomErr = Object.assign(new Error('original boom'), {
      isBoom: true,
      output: { statusCode: 403 }
    })
    findOne.mockRejectedValue(boomErr)
    await expect(
      getIatContextController.handler(request, global.mockHandler)
    ).rejects.toBe(boomErr)
    expect(request.logger.error).not.toHaveBeenCalled()
  })

  test('logs and wraps non-Boom errors as Boom.internal', async () => {
    findOne.mockRejectedValue(new Error('mongo down'))
    await expect(
      getIatContextController.handler(request, global.mockHandler)
    ).rejects.toThrow(/mongo down/)
    expect(request.logger.error).toHaveBeenCalledWith(
      expect.any(Object),
      'Error fetching IAT context'
    )
  })
})
