import { describe, expect, it, vi, beforeEach } from 'vitest'
import { updateIatAnswersController } from './update-iat-answers.js'

const validPayload = {
  outcome: {
    route: '/outcome/licence-not-required/article-17a',
    typeId: 'lnr-art17a',
    summaryText: 'You do not need a marine licence.'
  },
  answers: [
    {
      questionRoute: '/sea',
      questionText: 'Where?',
      answers: [{ id: 'inSea', text: 'In the sea' }]
    }
  ]
}

function buildRequest(overrides = {}) {
  return {
    params: { id: '507f1f77bcf86cd799439011' },
    payload: validPayload,
    db: global.mockMongo,
    auth: {},
    ...overrides
  }
}

describe('updateIatAnswersController', () => {
  const findOne = vi.fn()
  const replaceOne = vi.fn()

  beforeEach(() => {
    findOne.mockReset()
    replaceOne.mockReset()
    global.mockMongo.collection = vi.fn(() => ({ findOne, replaceOne }))
  })

  it('overwrites by id, preserves createdAt/createdBy, bumps updatedAt/updatedBy', async () => {
    const existingCreatedAt = new Date('2026-01-01T00:00:00Z')
    findOne.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      createdAt: existingCreatedAt,
      createdBy: 'first-user'
    })
    replaceOne.mockResolvedValue({})

    await updateIatAnswersController.handler(
      buildRequest({ auth: { credentials: { contactId: 'second-user' } } }),
      global.mockHandler
    )

    const replacement = replaceOne.mock.calls[0][1]
    expect(replacement.createdAt).toBe(existingCreatedAt)
    expect(replacement.createdBy).toBe('first-user')
    expect(replacement.updatedAt).toBeInstanceOf(Date)
    expect(replacement.updatedBy).toBe('second-user')
    expect(replacement.outcome).toEqual(validPayload.outcome)
  })

  it('returns 404 when the id is absent', async () => {
    findOne.mockResolvedValue(null)
    await expect(
      updateIatAnswersController.handler(buildRequest(), global.mockHandler)
    ).rejects.toMatchObject({ output: { statusCode: 404 } })
    expect(replaceOne).not.toHaveBeenCalled()
  })

  it('sanitises outcome.summaryText before replaceOne', async () => {
    const existingCreatedAt = new Date('2026-01-01T00:00:00Z')
    findOne.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      createdAt: existingCreatedAt,
      createdBy: 'first-user'
    })
    replaceOne.mockResolvedValue({})

    const dirtyPayload = {
      ...validPayload,
      outcome: {
        ...validPayload.outcome,
        summaryText:
          '<p>updated</p><script>alert(1)</script><a href="javascript:bad">x</a>'
      }
    }

    await updateIatAnswersController.handler(
      buildRequest({ payload: dirtyPayload }),
      global.mockHandler
    )

    const replacement = replaceOne.mock.calls[0][1]
    expect(replacement.outcome.summaryText).toBe('<p>updated</p><a>x</a>')
    // Audit invariants still hold.
    expect(replacement.createdAt).toBe(existingCreatedAt)
    expect(replacement.createdBy).toBe('first-user')
  })
})
