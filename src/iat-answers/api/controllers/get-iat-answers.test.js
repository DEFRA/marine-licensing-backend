import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'
import { getIatAnswersController } from './get-iat-answers.js'

const buildRequest = () => ({
  params: { id: '507f1f77bcf86cd799439011' },
  db: global.mockMongo
})

describe('getIatAnswersController', () => {
  const findOne = vi.fn()

  beforeEach(() => {
    findOne.mockReset()
    global.mockMongo.collection = vi.fn(() => ({ findOne }))
  })

  it('returns the document on hit', async () => {
    const docId = new ObjectId('507f1f77bcf86cd799439011')
    findOne.mockResolvedValue({
      _id: docId,
      outcome: { route: '/o', typeId: 't', summaryText: 's' },
      answers: [],
      createdAt: new Date(),
      createdBy: null,
      updatedAt: new Date(),
      updatedBy: null
    })

    await getIatAnswersController.handler(buildRequest(), global.mockHandler)

    expect(global.mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'success',
        value: expect.objectContaining({
          id: docId.toString(),
          outcome: { route: '/o', typeId: 't', summaryText: 's' }
        })
      })
    )
    expect(global.mockHandler.code).toHaveBeenCalledWith(200)
  })

  it('throws 404 when absent', async () => {
    findOne.mockResolvedValue(null)
    await expect(
      getIatAnswersController.handler(buildRequest(), global.mockHandler)
    ).rejects.toMatchObject({ output: { statusCode: 404 } })
  })
})
