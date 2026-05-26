import { describe, expect, test, vi, beforeEach } from 'vitest'
import { StatusCodes } from 'http-status-codes'
import { createIatContextController } from './create-iat-context.js'

vi.mock('../../../iat-shared/helpers/generate-slug.js', () => ({
  generateSlug: vi.fn(() => 'A'.repeat(22))
}))

describe('createIatContextController', () => {
  let insertOne, collection, db, request

  beforeEach(() => {
    insertOne = vi.fn().mockResolvedValue({ insertedId: 'x' })
    collection = vi.fn(() => ({ insertOne }))
    db = { collection }
    request = {
      db,
      auth: { isAuthenticated: false },
      logger: { error: vi.fn() }
    }
  })

  test('inserts an empty context with slug, expiresAt and audit fields', async () => {
    await createIatContextController.handler(request, global.mockHandler)
    expect(collection).toHaveBeenCalledWith('iat-contexts')
    const inserted = insertOne.mock.calls[0][0]
    expect(inserted.slug).toBe('A'.repeat(22))
    expect(inserted.questionLog).toEqual([])
    expect(inserted.expiresAt).toBeInstanceOf(Date)
    expect(inserted.createdAt).toBeInstanceOf(Date)
    expect(global.mockHandler.response).toHaveBeenCalledWith({
      message: 'success',
      value: { slug: 'A'.repeat(22) }
    })
    expect(global.mockHandler.code).toHaveBeenCalledWith(StatusCodes.CREATED)
  })

  test('retries with a new slug on duplicate key collision', async () => {
    insertOne
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 11000 }))
      .mockResolvedValueOnce({ insertedId: 'x' })
    await createIatContextController.handler(request, global.mockHandler)
    expect(insertOne).toHaveBeenCalledTimes(2)
  })

  test('payload is ignored (parse: false)', () => {
    expect(createIatContextController.options.payload).toEqual({ parse: false })
  })
})
