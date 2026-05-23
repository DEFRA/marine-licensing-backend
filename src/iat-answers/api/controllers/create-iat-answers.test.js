import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createIatAnswersController } from './create-iat-answers.js'
import { collectionIatAnswers } from '../../../shared/common/constants/db-collections.js'

const FIXED_NOW = 1747920000000
const TTL_MS = 24 * 60 * 60 * 1000

describe('createIatAnswersController', () => {
  let insertOne, db, request, h

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
    insertOne = vi.fn().mockResolvedValue({ insertedId: 'x' })
    db = { collection: vi.fn(() => ({ insertOne })) }
    h = global.mockHandler
    request = {
      db,
      auth: { credentials: null },
      logger: { error: vi.fn() }
    }
  })

  afterEach(() => vi.useRealTimers())

  it('inserts a doc with generated slug, empty answers, published: false, computed expiresAt', async () => {
    await createIatAnswersController.handler(request, h)
    expect(db.collection).toHaveBeenCalledWith(collectionIatAnswers)
    const doc = insertOne.mock.calls[0][0]
    expect(doc.slug).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(doc.answers).toEqual([])
    expect(doc.published).toBe(false)
    expect(doc.expiresAt).toBeInstanceOf(Date)
    expect(doc.expiresAt.getTime()).toBe(FIXED_NOW + TTL_MS)
  })

  it('returns 201 with the slug in value', async () => {
    await createIatAnswersController.handler(request, h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'success',
        value: expect.objectContaining({
          slug: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/)
        })
      })
    )
    expect(h.code).toHaveBeenCalledWith(201)
  })

  it('regenerates slug on duplicate-key collision and retries once', async () => {
    const dupErr = Object.assign(new Error('dup'), { code: 11000 })
    insertOne
      .mockRejectedValueOnce(dupErr)
      .mockResolvedValueOnce({ insertedId: 'x' })
    await createIatAnswersController.handler(request, h)
    expect(insertOne).toHaveBeenCalledTimes(2)
    const firstSlug = insertOne.mock.calls[0][0].slug
    const secondSlug = insertOne.mock.calls[1][0].slug
    expect(secondSlug).not.toBe(firstSlug)
  })

  it('uses server-side TTL (frontend cannot supply expiresAt)', async () => {
    await createIatAnswersController.handler(request, h)
    const doc = insertOne.mock.calls[0][0]
    expect(doc.expiresAt.getTime()).toBe(FIXED_NOW + TTL_MS)
  })

  it('writes create audit fields when caller is authenticated', async () => {
    request.auth = {
      credentials: { contactId: 'user-123', email: 'u@example.com' }
    }
    await createIatAnswersController.handler(request, h)
    const doc = insertOne.mock.calls[0][0]
    expect(doc.createdAt).toBeDefined()
    expect(doc.createdBy).toBe('user-123')
  })

  it('does not parse incoming body (payload.parse: false)', () => {
    expect(createIatAnswersController.options.payload).toEqual(
      expect.objectContaining({ parse: false })
    )
  })
})
