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

  test('returns the context doc when found', async () => {
    const doc = { slug: validSlug, questionLog: [{ questionRoute: '/q1' }] }
    findOne.mockResolvedValue(doc)
    await getIatContextController.handler(request, global.mockHandler)
    expect(db.collection).toHaveBeenCalledWith('iat-contexts')
    expect(global.mockHandler.response).toHaveBeenCalledWith({
      message: 'success',
      value: doc
    })
  })

  test('404 when slug unknown / TTL-expired', async () => {
    findOne.mockResolvedValue(null)
    await expect(
      getIatContextController.handler(request, global.mockHandler)
    ).rejects.toThrow('IAT context not found or expired')
  })
})
