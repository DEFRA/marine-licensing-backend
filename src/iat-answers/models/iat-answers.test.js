import { describe, expect, it } from 'vitest'
import { iatAnswersBody, iatAnswersIdParams } from './iat-answers.js'

const validBody = {
  outcome: {
    route: '/outcome/licence-not-required/article-17a',
    typeId: 'lnr-art17a',
    summaryText: 'You do not need a marine licence ...'
  },
  answers: [
    {
      questionRoute: '/sea',
      questionText: 'Where will the activity take place?',
      answers: [{ id: 'inSea', text: 'In the sea' }]
    }
  ]
}

describe('iatAnswersIdParams', () => {
  it('accepts a 24-char hex id', () => {
    const { error } = iatAnswersIdParams.validate({
      id: '507f1f77bcf86cd799439011'
    })
    expect(error).toBeUndefined()
  })

  it('rejects non-hex id', () => {
    const { error } = iatAnswersIdParams.validate({ id: 'xyz' })
    expect(error?.details[0].message).toBe('IAT_ANSWERS_ID_REQUIRED')
  })

  it('rejects 25-char id', () => {
    const { error } = iatAnswersIdParams.validate({
      id: '507f1f77bcf86cd7994390111'
    })
    expect(error?.details[0].message).toBe('IAT_ANSWERS_ID_REQUIRED')
  })

  it('rejects 24-char non-hex id with IAT_ANSWERS_ID_INVALID', () => {
    const { error } = iatAnswersIdParams.validate({
      id: 'zzzzzzzzzzzzzzzzzzzzzzzz'
    })
    expect(error?.details[0].message).toBe('IAT_ANSWERS_ID_INVALID')
  })
})

describe('iatAnswersBody', () => {
  it('accepts a valid payload', () => {
    const { error } = iatAnswersBody.validate(validBody)
    expect(error).toBeUndefined()
  })

  it('rejects an empty answers array', () => {
    const { error } = iatAnswersBody.validate({
      ...validBody,
      answers: []
    })
    expect(error).toBeDefined()
  })

  it('rejects when outcome.route is missing', () => {
    const { outcome, ...rest } = validBody
    const { error } = iatAnswersBody.validate({
      ...rest,
      outcome: { typeId: outcome.typeId, summaryText: outcome.summaryText }
    })
    expect(error).toBeDefined()
  })

  it('rejects when an answer entry has no inner answers', () => {
    const { error } = iatAnswersBody.validate({
      ...validBody,
      answers: [
        {
          questionRoute: '/sea',
          questionText: 'Where?',
          answers: []
        }
      ]
    })
    expect(error).toBeDefined()
  })

  it('rejects an answer entry exceeding 100 entries', () => {
    const tooMany = Array.from({ length: 101 }, () => ({
      questionRoute: '/q',
      questionText: 'Q?',
      answers: [{ id: 'a', text: 'a' }]
    }))
    const { error } = iatAnswersBody.validate({
      ...validBody,
      answers: tooMany
    })
    expect(error).toBeDefined()
  })
})
