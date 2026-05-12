import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createIatAnswersController } from './create-iat-answers.js'

const validPayload = {
  outcome: {
    route: '/outcome/licence-not-required/article-17a',
    typeId: 'lnr-art17a',
    summaryText: 'You do not need a marine licence.'
  },
  answers: [
    {
      questionRoute: '/sea',
      questionText: 'Where will the activity take place?',
      answers: [{ id: 'inSea', text: 'In the sea' }]
    }
  ]
}

function buildRequest(overrides = {}) {
  return {
    payload: validPayload,
    db: global.mockMongo,
    auth: {},
    ...overrides
  }
}

describe('createIatAnswersController', () => {
  const insertOne = vi.fn()

  beforeEach(() => {
    insertOne.mockReset()
    global.mockMongo.collection = vi.fn(() => ({ insertOne }))
  })

  it('inserts the doc with audit fields and returns its id (anonymous)', async () => {
    insertOne.mockResolvedValue({ insertedId: { toString: () => 'abc123' } })

    const h = global.mockHandler
    await createIatAnswersController.handler(buildRequest(), h)

    expect(global.mockMongo.collection).toHaveBeenCalledWith('iat-answers')
    const inserted = insertOne.mock.calls[0][0]
    expect(inserted.createdAt).toBeInstanceOf(Date)
    expect(inserted.updatedAt).toBeInstanceOf(Date)
    expect(inserted.createdBy).toBeNull()
    expect(inserted.updatedBy).toBeNull()
    expect(inserted.outcome).toEqual(validPayload.outcome)
    expect(h.response).toHaveBeenCalledWith({
      message: 'success',
      value: { id: 'abc123' }
    })
    expect(h.code).toHaveBeenCalledWith(201)
  })

  it('captures contactId when an auth token is present', async () => {
    insertOne.mockResolvedValue({ insertedId: { toString: () => 'abc' } })
    await createIatAnswersController.handler(
      buildRequest({ auth: { credentials: { contactId: 'user-1' } } }),
      global.mockHandler
    )
    const inserted = insertOne.mock.calls[0][0]
    expect(inserted.createdBy).toBe('user-1')
    expect(inserted.updatedBy).toBe('user-1')
  })

  it('wraps unknown errors as Boom.internal', async () => {
    insertOne.mockRejectedValue(new Error('db down'))
    await expect(
      createIatAnswersController.handler(buildRequest(), global.mockHandler)
    ).rejects.toMatchObject({ isBoom: true, output: { statusCode: 500 } })
  })
})
