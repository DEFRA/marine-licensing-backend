import { describe, it, expect, beforeEach, vi } from 'vitest'
import { publishIatAnswersController } from './publish-iat-answers.js'
import { collectionIatAnswers } from '../../../shared/common/constants/db-collections.js'

describe('publishIatAnswersController', () => {
  const slug = 'abcdefghijklmnopqrstuv'
  let updateOne, db, request, h

  beforeEach(() => {
    updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 })
    db = { collection: vi.fn(() => ({ updateOne })) }
    h = global.mockHandler
    request = {
      db,
      params: { slug },
      auth: { credentials: null }
    }
  })

  it('sets published: true and $unset expiresAt, filtered by slug', async () => {
    await publishIatAnswersController.handler(request, h)
    expect(db.collection).toHaveBeenCalledWith(collectionIatAnswers)
    expect(updateOne).toHaveBeenCalledWith(
      { slug },
      expect.objectContaining({
        $set: expect.objectContaining({ published: true }),
        $unset: { expiresAt: '' }
      })
    )
  })

  it('returns 200 success on match', async () => {
    await publishIatAnswersController.handler(request, h)
    expect(h.response).toHaveBeenCalledWith({ message: 'success' })
    expect(h.code).toHaveBeenCalledWith(200)
  })

  it('is idempotent (re-publishing a published doc still matches)', async () => {
    updateOne.mockResolvedValueOnce({ matchedCount: 1 })
    await publishIatAnswersController.handler(request, h)
    // No throw is the assertion.
  })

  it('throws Boom.notFound with descriptive message when slug does not exist', async () => {
    updateOne.mockResolvedValueOnce({ matchedCount: 0 })
    await expect(
      publishIatAnswersController.handler(request, h)
    ).rejects.toThrow('IAT answers not found')
  })

  it('writes update audit fields when caller is authenticated', async () => {
    request.auth = {
      credentials: { contactId: 'user-123', email: 'u@example.com' }
    }
    await publishIatAnswersController.handler(request, h)
    const setPayload = updateOne.mock.calls[0][1].$set
    expect(setPayload.updatedAt).toBeDefined()
    expect(setPayload.updatedBy).toBe('user-123')
  })
})
