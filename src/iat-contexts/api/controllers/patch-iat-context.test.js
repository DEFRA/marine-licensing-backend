import { describe, expect, test, vi, beforeEach } from 'vitest'
import { patchIatContextController } from './patch-iat-context.js'

describe('patchIatContextController', () => {
  let findOne, updateOne, db, request

  const validSlug = 'a'.repeat(22)
  const ctxBase = {
    slug: validSlug,
    questionLog: [
      {
        questionRoute: '/q1',
        questionText: 'Q1',
        answerId: 'A',
        answerText: 'A',
        mcmsAppFormMapping: null,
        answeredAt: new Date()
      },
      {
        questionRoute: '/q2',
        questionText: 'Q2',
        answerId: 'B',
        answerText: 'B',
        mcmsAppFormMapping: null,
        answeredAt: new Date()
      },
      {
        questionRoute: '/q3',
        questionText: 'Q3',
        answerId: 'C',
        answerText: 'C',
        mcmsAppFormMapping: null,
        answeredAt: new Date()
      }
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
    request.payload = {
      answer: {
        questionRoute: '/q4',
        questionText: 'Q4',
        answerId: 'D',
        answerText: 'D',
        mcmsAppFormMapping: null
      }
    }
    await patchIatContextController.handler(request, global.mockHandler)
    const update = updateOne.mock.calls[0][1].$set
    expect(update.questionLog).toHaveLength(4)
    expect(update.questionLog[3].questionRoute).toBe('/q4')
  })

  test('back-track truncate: existing route truncates everything from that point and re-appends', async () => {
    findOne.mockResolvedValue({ ...ctxBase })
    request.payload = {
      answer: {
        questionRoute: '/q2',
        questionText: 'Q2',
        answerId: 'B2',
        answerText: 'B prime',
        mcmsAppFormMapping: null
      }
    }
    await patchIatContextController.handler(request, global.mockHandler)
    const update = updateOne.mock.calls[0][1].$set
    expect(update.questionLog).toHaveLength(2)
    expect(update.questionLog[0].questionRoute).toBe('/q1')
    expect(update.questionLog[1].answerId).toBe('B2')
  })

  test('first answer to a new context: empty log becomes one-entry log', async () => {
    findOne.mockResolvedValue({ slug: validSlug, questionLog: [] })
    request.payload = {
      answer: {
        questionRoute: '/q1',
        questionText: 'Q1',
        answerId: 'A',
        answerText: 'A',
        mcmsAppFormMapping: null
      }
    }
    await patchIatContextController.handler(request, global.mockHandler)
    expect(updateOne.mock.calls[0][1].$set.questionLog).toHaveLength(1)
  })

  test('404 when slug unknown / TTL-expired', async () => {
    findOne.mockResolvedValue(null)
    request.payload = {
      answer: {
        questionRoute: '/q1',
        questionText: 'Q1',
        answerId: 'A',
        answerText: 'A',
        mcmsAppFormMapping: null
      }
    }
    await expect(
      patchIatContextController.handler(request, global.mockHandler)
    ).rejects.toThrow('IAT context not found or expired')
  })

  test('audit fields populated (updatedAt / updatedBy)', async () => {
    findOne.mockResolvedValue({ ...ctxBase })
    request.payload = {
      answer: {
        questionRoute: '/q4',
        questionText: 'Q4',
        answerId: 'D',
        answerText: 'D',
        mcmsAppFormMapping: null
      }
    }
    await patchIatContextController.handler(request, global.mockHandler)
    const update = updateOne.mock.calls[0][1].$set
    expect(update.updatedAt).toBeInstanceOf(Date)
    expect('updatedBy' in update).toBe(true)
  })
})
