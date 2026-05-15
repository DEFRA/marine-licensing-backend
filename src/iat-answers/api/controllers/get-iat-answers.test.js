import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getIatAnswersController } from './get-iat-answers.js'

const TEST_SLUG = 'AZ4rr6bLclCVUsE2Pl_zKw'

const buildRequest = () => ({
  params: { slug: TEST_SLUG },
  db: global.mockMongo
})

describe('getIatAnswersController', () => {
  const findOne = vi.fn()

  beforeEach(() => {
    findOne.mockReset()
    global.mockMongo.collection = vi.fn(() => ({ findOne }))
  })

  it('returns the document on hit', async () => {
    findOne.mockResolvedValue({
      _id: 'internal-mongo-id',
      slug: TEST_SLUG,
      outcome: { route: '/o', typeId: 't', summaryText: 's' },
      answers: [],
      createdAt: new Date(),
      createdBy: null,
      updatedAt: new Date(),
      updatedBy: null
    })

    await getIatAnswersController.handler(buildRequest(), global.mockHandler)

    expect(global.mockMongo.collection).toHaveBeenCalledWith('iat-answers')
    expect(findOne).toHaveBeenCalledWith({ slug: TEST_SLUG })

    expect(global.mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'success',
        value: expect.objectContaining({
          slug: TEST_SLUG,
          outcome: { route: '/o', typeId: 't', summaryText: 's' }
        })
      })
    )
    const responseValue = global.mockHandler.response.mock.calls[0][0].value
    expect(responseValue).not.toHaveProperty('_id')
    expect(global.mockHandler.code).toHaveBeenCalledWith(200)
  })

  it('throws 404 when absent', async () => {
    findOne.mockResolvedValue(null)
    await expect(
      getIatAnswersController.handler(buildRequest(), global.mockHandler)
    ).rejects.toMatchObject({ output: { statusCode: 404 } })
  })

  it('rethrows non-Boom database errors as Boom.internal', async () => {
    findOne.mockRejectedValue(new Error('db error'))
    await expect(
      getIatAnswersController.handler(buildRequest(), global.mockHandler)
    ).rejects.toMatchObject({ isBoom: true, output: { statusCode: 500 } })
  })
})
