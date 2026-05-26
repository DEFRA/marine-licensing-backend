import { describe, expect, test, vi, beforeEach } from 'vitest'
import { getOutcomeDocumentController } from './get-outcome-document.js'

describe('getOutcomeDocumentController', () => {
  let findOne, db, request
  const validSlug = 'b'.repeat(22)

  beforeEach(() => {
    findOne = vi.fn()
    db = { collection: vi.fn(() => ({ findOne })) }
    request = {
      db,
      params: { slug: validSlug },
      logger: { error: vi.fn() }
    }
  })

  test('returns the doc when found', async () => {
    const doc = { slug: validSlug, focusedOption: { id: 'X' }, questionLog: [] }
    findOne.mockResolvedValue(doc)
    await getOutcomeDocumentController.handler(request, global.mockHandler)
    expect(db.collection).toHaveBeenCalledWith('iat-outcome-documents')
    expect(global.mockHandler.response).toHaveBeenCalledWith({
      message: 'success',
      value: doc
    })
  })

  test('404 when absent', async () => {
    findOne.mockResolvedValue(null)
    await expect(
      getOutcomeDocumentController.handler(request, global.mockHandler)
    ).rejects.toThrow('Outcome document not found')
  })
})
