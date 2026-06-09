import { describe, expect, test, vi, beforeEach } from 'vitest'
import { patchIatContextController } from './patch-iat-context.js'

const mkLogEntry = (route, id, text) => ({
  questionRoute: route,
  questionText: route.slice(1).toUpperCase(),
  answers: [{ id, text }],
  mcmsAppFormMapping: null,
  answeredAt: new Date()
})

const mkPayload = (route, id, text, mapping = null) => ({
  answer: {
    questionRoute: route,
    questionText: route.slice(1).toUpperCase(),
    answers: [{ id, text }],
    mcmsAppFormMapping: mapping
  }
})

describe('patchIatContextController', () => {
  let findOne, updateOne, db, request

  const validSlug = 'a'.repeat(22)
  const ctxBase = {
    slug: validSlug,
    questionLog: [
      mkLogEntry('/q1', 'A', 'A'),
      mkLogEntry('/q2', 'B', 'B'),
      mkLogEntry('/q3', 'C', 'C')
    ]
  }

  beforeEach(() => {
    findOne = vi.fn()
    updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 })
    db = { collection: vi.fn(() => ({ findOne, updateOne })) }
    request = {
      db,
      auth: { isAuthenticated: false },
      params: { slug: validSlug },
      logger: { error: vi.fn() }
    }
  })

  test('forward append: new route not in log appends to the end', async () => {
    findOne.mockResolvedValue({ ...ctxBase })
    request.payload = mkPayload('/q4', 'D', 'D')
    await patchIatContextController.handler(request, global.mockHandler)
    const update = updateOne.mock.calls[0][1].$set
    expect(update.questionLog).toHaveLength(4)
    expect(update.questionLog[3].questionRoute).toBe('/q4')
  })

  test('back-track truncate: existing route truncates everything from that point and re-appends', async () => {
    findOne.mockResolvedValue({ ...ctxBase })
    request.payload = mkPayload('/q2', 'B2', 'B prime')
    await patchIatContextController.handler(request, global.mockHandler)
    const update = updateOne.mock.calls[0][1].$set
    expect(update.questionLog).toHaveLength(2)
    expect(update.questionLog[0].questionRoute).toBe('/q1')
    expect(update.questionLog[1].answers[0].id).toBe('B2')
  })

  test('first answer to a new context: empty log becomes one-entry log', async () => {
    findOne.mockResolvedValue({ slug: validSlug, questionLog: [] })
    request.payload = mkPayload('/q1', 'A', 'A')
    await patchIatContextController.handler(request, global.mockHandler)
    expect(updateOne.mock.calls[0][1].$set.questionLog).toHaveLength(1)
  })

  test('multi-select: payload with multiple answers is stored as-is', async () => {
    findOne.mockResolvedValue({ slug: validSlug, questionLog: [] })
    request.payload = {
      answer: {
        questionRoute: '/q1',
        questionText: 'Q1',
        answers: [
          { id: 'A', text: 'Apple' },
          { id: 'B', text: 'Banana' }
        ],
        mcmsAppFormMapping: 'FRUITS'
      }
    }
    await patchIatContextController.handler(request, global.mockHandler)
    const stored = updateOne.mock.calls[0][1].$set.questionLog[0]
    expect(stored.answers).toEqual([
      { id: 'A', text: 'Apple' },
      { id: 'B', text: 'Banana' }
    ])
  })

  test('404 when slug unknown / TTL-expired', async () => {
    findOne.mockResolvedValue(null)
    request.payload = mkPayload('/q1', 'A', 'A')
    await expect(
      patchIatContextController.handler(request, global.mockHandler)
    ).rejects.toThrow('IAT context not found or expired')
  })

  test('audit fields populated (updatedAt / updatedBy)', async () => {
    findOne.mockResolvedValue({ ...ctxBase })
    request.payload = mkPayload('/q4', 'D', 'D')
    await patchIatContextController.handler(request, global.mockHandler)
    const update = updateOne.mock.calls[0][1].$set
    expect(update.updatedAt).toBeInstanceOf(Date)
    expect('updatedBy' in update).toBe(true)
  })

  test('404 when updateOne matchedCount is 0 (context deleted between findOne and updateOne)', async () => {
    findOne.mockResolvedValue({ ...ctxBase })
    updateOne.mockResolvedValue({ matchedCount: 0 })
    request.payload = mkPayload('/q4', 'D', 'D')
    await expect(
      patchIatContextController.handler(request, global.mockHandler)
    ).rejects.toThrow('IAT context not found or expired')
  })

  test('logs and wraps non-Boom errors as Boom.internal', async () => {
    findOne.mockRejectedValue(new Error('mongo down'))
    request.payload = mkPayload('/q1', 'A', 'A')
    await expect(
      patchIatContextController.handler(request, global.mockHandler)
    ).rejects.toThrow(/mongo down/)
    expect(request.logger.error).toHaveBeenCalledWith(
      expect.any(Object),
      'Error patching IAT context'
    )
  })

  test('falls back to an empty questionLog when the existing context has no questionLog field', async () => {
    findOne.mockResolvedValue({ slug: validSlug })
    request.payload = mkPayload('/q1', 'A', 'A')
    await patchIatContextController.handler(request, global.mockHandler)
    const stored = updateOne.mock.calls[0][1].$set.questionLog
    expect(stored).toHaveLength(1)
    expect(stored[0].questionRoute).toBe('/q1')
  })
})
