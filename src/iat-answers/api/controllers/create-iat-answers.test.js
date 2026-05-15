import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createIatAnswersController } from './create-iat-answers.js'

const SLUG_PATTERN = /^[A-Za-z0-9_-]{22}$/

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

  it('inserts the doc with slug + audit fields and returns the slug (anonymous)', async () => {
    insertOne.mockResolvedValue({})

    const h = global.mockHandler
    await createIatAnswersController.handler(buildRequest(), h)

    expect(global.mockMongo.collection).toHaveBeenCalledWith('iat-answers')
    const inserted = insertOne.mock.calls[0][0]
    expect(inserted.createdAt).toBeInstanceOf(Date)
    expect(inserted.updatedAt).toBeInstanceOf(Date)
    expect(inserted.createdBy).toBeNull()
    expect(inserted.updatedBy).toBeNull()
    expect(inserted.slug).toMatch(SLUG_PATTERN)
    expect(inserted.outcome).toEqual(validPayload.outcome)

    const responseArg = h.response.mock.calls[0][0]
    expect(responseArg.message).toBe('success')
    expect(responseArg.value.slug).toMatch(SLUG_PATTERN)
    expect(responseArg.value.slug).toBe(inserted.slug)
    expect(h.code).toHaveBeenCalledWith(201)
  })

  it('captures contactId when an auth token is present', async () => {
    insertOne.mockResolvedValue({})
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

  it('sanitises outcome.summaryText before insertOne', async () => {
    insertOne.mockResolvedValue({})

    const dirtyPayload = {
      ...validPayload,
      outcome: {
        ...validPayload.outcome,
        summaryText:
          '<p>ok</p><script>alert(1)</script><a href="javascript:bad">x</a>'
      }
    }

    await createIatAnswersController.handler(
      buildRequest({ payload: dirtyPayload }),
      global.mockHandler
    )

    const inserted = insertOne.mock.calls[0][0]
    expect(inserted.outcome.summaryText).toBe('<p>ok</p><a>x</a>')
    expect(inserted.outcome.route).toBe(validPayload.outcome.route)
    expect(inserted.outcome.typeId).toBe(validPayload.outcome.typeId)
    expect(inserted.answers).toEqual(validPayload.answers)
  })

  it('retries with a fresh slug when insertOne throws E11000 once then resolves', async () => {
    const duplicateError = Object.assign(new Error('E11000 duplicate key'), {
      code: 11000
    })
    insertOne.mockRejectedValueOnce(duplicateError).mockResolvedValueOnce({})

    const h = global.mockHandler
    await createIatAnswersController.handler(buildRequest(), h)

    expect(insertOne).toHaveBeenCalledTimes(2)
    const firstSlug = insertOne.mock.calls[0][0].slug
    const retrySlug = insertOne.mock.calls[1][0].slug
    expect(retrySlug).toMatch(SLUG_PATTERN)

    const responseArg = h.response.mock.calls[0][0]
    expect(responseArg.value.slug).toBe(retrySlug)
    expect(responseArg.value.slug).not.toBe(firstSlug)
  })

  it('rethrows non-duplicate-key errors as Boom.internal', async () => {
    const otherError = Object.assign(new Error('connection refused'), {
      code: 99999
    })
    insertOne.mockRejectedValue(otherError)
    await expect(
      createIatAnswersController.handler(buildRequest(), global.mockHandler)
    ).rejects.toMatchObject({ isBoom: true, output: { statusCode: 500 } })
  })
})
