import { describe, expect, test, vi, beforeEach } from 'vitest'
import { StatusCodes } from 'http-status-codes'
import { mintOutcomeDocumentController } from './mint-outcome-document.js'

vi.mock('../../../iat-shared/helpers/generate-slug.js', () => ({
  generateSlug: vi.fn(() => 'B'.repeat(22))
}))

describe('mintOutcomeDocumentController', () => {
  let findOne, insertOne, db, request
  const contextSlug = 'a'.repeat(22)
  const baseContext = {
    slug: contextSlug,
    questionLog: [
      {
        questionRoute: '/q1',
        questionText: 'Q1',
        answers: [{ id: 'A', text: 'A' }],
        mcmsAppFormMapping: 'ACTIVITY_TYPE',
        answeredAt: new Date('2026-05-26T00:00:00Z')
      }
    ]
  }
  const baseBody = {
    preamble: 'The purpose of the MMO marine licence requirement checker tool…',
    outcomeRoute: '/outcome-a',
    outcomeKind: 'terminal-single',
    outcomeHeading: 'You may need …',
    outcomeText: '',
    focusedOption: {
      id: 'WO_FOO',
      heading: 'Option',
      text: '<p>summary</p>',
      module: null,
      link: null,
      overrideCtaButtonUrl: null,
      params: null
    }
  }

  beforeEach(() => {
    findOne = vi.fn().mockResolvedValue(baseContext)
    // The real MongoDB driver mutates the passed doc in place, adding _id
    // before the insert resolves. Mirror that so the _id-stripping is tested.
    insertOne = vi.fn().mockImplementation((doc) => {
      doc._id = 'mongo-object-id'
      return Promise.resolve({ insertedId: doc._id })
    })
    db = {
      collection: vi.fn((name) =>
        name === 'iat-contexts' ? { findOne } : { insertOne }
      )
    }
    request = {
      db,
      auth: { isAuthenticated: false },
      params: { slug: contextSlug },
      payload: baseBody,
      logger: { error: vi.fn() }
    }
  })

  test('copies the context questionLog verbatim into the snapshot', async () => {
    await mintOutcomeDocumentController.handler(request, global.mockHandler)
    const written = insertOne.mock.calls[0][0]
    expect(written.questionLog).toEqual(baseContext.questionLog)
  })

  test('returns slug + viewUrl + full snapshot in response value', async () => {
    await mintOutcomeDocumentController.handler(request, global.mockHandler)
    expect(global.mockHandler.code).toHaveBeenCalledWith(StatusCodes.CREATED)
    const responseArg = global.mockHandler.response.mock.calls[0][0]
    expect(responseArg.value.slug).toBe('B'.repeat(22))
    expect(responseArg.value.viewUrl).toBe(
      `/journey/self-service/outcome-document/${'B'.repeat(22)}`
    )
    expect(responseArg.value.snapshot.contextSlug).toBe(contextSlug)
    expect(responseArg.value.snapshot.focusedOption.id).toBe('WO_FOO')
    expect(responseArg.value.snapshot).not.toHaveProperty('_id')
  })

  test('snapshot includes capturedAt and contextSlug', async () => {
    await mintOutcomeDocumentController.handler(request, global.mockHandler)
    const written = insertOne.mock.calls[0][0]
    expect(written.contextSlug).toBe(contextSlug)
    expect(written.capturedAt).toBeInstanceOf(Date)
  })

  test('persists preamble verbatim from the mint payload', async () => {
    await mintOutcomeDocumentController.handler(request, global.mockHandler)
    const written = insertOne.mock.calls[0][0]
    expect(written.preamble).toBe(baseBody.preamble)
  })

  test('404 when context slug unknown / TTL-expired', async () => {
    findOne.mockResolvedValue(null)
    await expect(
      mintOutcomeDocumentController.handler(request, global.mockHandler)
    ).rejects.toThrow('IAT context not found or expired')
  })

  test('each call inserts a new doc with a new slug (no dedup)', async () => {
    const { generateSlug } =
      await import('../../../iat-shared/helpers/generate-slug.js')
    generateSlug
      .mockReturnValueOnce('B'.repeat(22))
      .mockReturnValueOnce('C'.repeat(22))
    await mintOutcomeDocumentController.handler(request, global.mockHandler)
    await mintOutcomeDocumentController.handler(request, global.mockHandler)
    expect(insertOne).toHaveBeenCalledTimes(2)
    expect(insertOne.mock.calls[0][0].slug).not.toBe(
      insertOne.mock.calls[1][0].slug
    )
  })

  test('retries with a new slug on insertOne duplicate-key collision', async () => {
    const { generateSlug } =
      await import('../../../iat-shared/helpers/generate-slug.js')
    generateSlug
      .mockReturnValueOnce('B'.repeat(22))
      .mockReturnValueOnce('D'.repeat(22))
    insertOne
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 11000 }))
      .mockImplementationOnce((doc) => {
        doc._id = 'retry-id'
        return Promise.resolve({ insertedId: doc._id })
      })
    await mintOutcomeDocumentController.handler(request, global.mockHandler)
    expect(insertOne).toHaveBeenCalledTimes(2)
    expect(insertOne.mock.calls[1][0].slug).toBe('D'.repeat(22))
  })

  test('re-throws non-duplicate-key insert errors verbatim', async () => {
    insertOne.mockRejectedValue(
      Object.assign(new Error('write concern failed'), { code: 64 })
    )
    await expect(
      mintOutcomeDocumentController.handler(request, global.mockHandler)
    ).rejects.toThrow(/write concern failed/)
  })

  test('logs and wraps non-Boom errors from findOne as Boom.internal', async () => {
    findOne.mockRejectedValue(new Error('mongo down'))
    await expect(
      mintOutcomeDocumentController.handler(request, global.mockHandler)
    ).rejects.toThrow(/mongo down/)
    expect(request.logger.error).toHaveBeenCalledWith(
      expect.any(Object),
      'Error minting outcome document'
    )
  })

  test('falls back to an empty questionLog when the context has no questionLog field', async () => {
    findOne.mockResolvedValue({ slug: contextSlug })
    await mintOutcomeDocumentController.handler(request, global.mockHandler)
    const written = insertOne.mock.calls[0][0]
    expect(written.questionLog).toEqual([])
  })
})
