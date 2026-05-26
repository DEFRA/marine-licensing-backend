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
    insertOne = vi.fn().mockResolvedValue({ insertedId: 'x' })
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
      `/outcome-documents/${'B'.repeat(22)}`
    )
    expect(responseArg.value.snapshot.contextSlug).toBe(contextSlug)
    expect(responseArg.value.snapshot.focusedOption.id).toBe('WO_FOO')
  })

  test('snapshot includes capturedAt and contextSlug', async () => {
    await mintOutcomeDocumentController.handler(request, global.mockHandler)
    const written = insertOne.mock.calls[0][0]
    expect(written.contextSlug).toBe(contextSlug)
    expect(written.capturedAt).toBeInstanceOf(Date)
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
})
