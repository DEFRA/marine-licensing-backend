import { describe, expect, it, vi, beforeEach } from 'vitest'
import { deleteIatAnswersController } from './delete-iat-answers.js'

const buildRequest = (overrides = {}) => ({
  params: { id: '507f1f77bcf86cd799439011' },
  db: global.mockMongo,
  ...overrides
})

describe('deleteIatAnswersController', () => {
  const deleteOne = vi.fn()

  beforeEach(() => {
    deleteOne.mockReset()
    global.mockMongo.collection = vi.fn(() => ({ deleteOne }))
  })

  it('returns 204 on delete', async () => {
    deleteOne.mockResolvedValue({ deletedCount: 1 })
    await deleteIatAnswersController.handler(buildRequest(), global.mockHandler)
    expect(global.mockMongo.collection).toHaveBeenCalledWith('iat-answers')
    expect(deleteOne).toHaveBeenCalled()
    expect(global.mockHandler.code).toHaveBeenCalledWith(204)
  })

  it('returns 204 even when the id is absent (idempotent)', async () => {
    deleteOne.mockResolvedValue({ deletedCount: 0 })
    await deleteIatAnswersController.handler(buildRequest(), global.mockHandler)
    expect(global.mockHandler.code).toHaveBeenCalledWith(204)
  })
})
