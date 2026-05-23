import { describe, it, expect, beforeEach, vi } from 'vitest'
import { patchIatAnswersController } from './patch-iat-answers.js'
import { collectionIatAnswers } from '../../../shared/common/constants/db-collections.js'

describe('patchIatAnswersController', () => {
  const slug = 'abcdefghijklmnopqrstuv'
  let updateOne, db, request, h

  beforeEach(() => {
    updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 })
    db = { collection: vi.fn(() => ({ updateOne })) }
    h = global.mockHandler
    request = {
      db,
      params: { slug },
      payload: {
        answers: [{ type: 'question', questionRoute: '/x', answerIds: ['A'] }]
      },
      auth: { credentials: null }
    }
  })

  it('updates the doc filtered by slug and published: false', async () => {
    await patchIatAnswersController.handler(request, h)
    expect(db.collection).toHaveBeenCalledWith(collectionIatAnswers)
    expect(updateOne).toHaveBeenCalledWith(
      { slug, published: false },
      expect.objectContaining({
        $set: expect.objectContaining({
          answers: request.payload.answers
        })
      })
    )
  })

  it('returns 200 success on match', async () => {
    await patchIatAnswersController.handler(request, h)
    expect(h.response).toHaveBeenCalledWith({ message: 'success' })
    expect(h.code).toHaveBeenCalledWith(200)
  })

  it('throws Boom.notFound when no doc matched (published or missing)', async () => {
    updateOne.mockResolvedValueOnce({ matchedCount: 0 })
    await expect(patchIatAnswersController.handler(request, h)).rejects.toThrow(
      'IAT answers not found or already published'
    )
  })

  it('validates payload against iatAnswersPatchBody', () => {
    const { error } =
      patchIatAnswersController.options.validate.payload.validate({
        answers: [{ type: 'question', questionRoute: '/x', answerIds: ['A'] }]
      })
    expect(error).toBeUndefined()
  })

  it('rejects unknown entry type via Joi', () => {
    const { error } =
      patchIatAnswersController.options.validate.payload.validate({
        answers: [{ type: 'banana', questionRoute: '/x' }]
      })
    expect(error).toBeDefined()
  })

  it('writes update audit fields when caller is authenticated', async () => {
    request.auth = {
      credentials: { contactId: 'user-123', email: 'u@example.com' }
    }
    await patchIatAnswersController.handler(request, h)
    const setPayload = updateOne.mock.calls[0][1].$set
    // addUpdateAuditFieldsOptional sets updatedAt + updatedBy when auth has credentials
    expect(setPayload.updatedAt).toBeDefined()
    expect(setPayload.updatedBy).toBe('user-123')
  })

  it('sets updatedAt and sets updatedBy to null when caller is unauthenticated', async () => {
    // request.auth.credentials is already null from beforeEach
    await patchIatAnswersController.handler(request, h)
    const setPayload = updateOne.mock.calls[0][1].$set
    // addUpdateAuditFieldsOptional always sets updatedAt; updatedBy is null when no credentials
    expect(setPayload.updatedAt).toBeDefined()
    expect(setPayload.updatedBy).toBeNull()
  })
})
