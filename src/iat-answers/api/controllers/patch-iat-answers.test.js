import { describe, it, expect, beforeEach, vi } from 'vitest'
import Boom from '@hapi/boom'
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
      Boom.notFound().message
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
})
