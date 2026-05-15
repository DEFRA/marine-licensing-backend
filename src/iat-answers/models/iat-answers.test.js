import { describe, expect, it } from 'vitest'
import { iatAnswersBody, iatAnswersSlugParams } from './iat-answers.js'

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

describe('iatAnswersSlugParams', () => {
  it('accepts a valid 22-char base64url slug', () => {
    const { error } = iatAnswersSlugParams.validate({
      slug: 'AZ4rr6bLclCVUsE2Pl_zKw'
    })
    expect(error).toBeUndefined()
  })

  it('rejects a 21-char slug', () => {
    const { error } = iatAnswersSlugParams.validate({
      slug: 'AZ4rr6bLclCVUsE2Pl_zK'
    })
    expect(error?.details[0].message).toBe('IAT_ANSWERS_SLUG_INVALID')
  })

  it('rejects a 23-char slug', () => {
    const { error } = iatAnswersSlugParams.validate({
      slug: 'AZ4rr6bLclCVUsE2Pl_zKwX'
    })
    expect(error?.details[0].message).toBe('IAT_ANSWERS_SLUG_INVALID')
  })

  it('rejects a 24-hex ObjectId-shaped string (length 24 != 22)', () => {
    const { error } = iatAnswersSlugParams.validate({
      slug: '507f1f77bcf86cd799439011'
    })
    expect(error?.details[0].message).toBe('IAT_ANSWERS_SLUG_INVALID')
  })

  it('rejects a 22-char string with a disallowed character (+)', () => {
    const { error } = iatAnswersSlugParams.validate({
      slug: 'AZ4rr6bLclCVUsE2Pl+zKw'
    })
    expect(error?.details[0].message).toBe('IAT_ANSWERS_SLUG_INVALID')
  })

  it('rejects a 22-char string with a disallowed character (/)', () => {
    const { error } = iatAnswersSlugParams.validate({
      slug: 'AZ4rr6bLclCVUsE2Pl/zKw'
    })
    expect(error?.details[0].message).toBe('IAT_ANSWERS_SLUG_INVALID')
  })

  it('rejects a 22-char string with a disallowed character (=)', () => {
    const { error } = iatAnswersSlugParams.validate({
      slug: 'AZ4rr6bLclCVUsE2Pl=zKw'
    })
    expect(error?.details[0].message).toBe('IAT_ANSWERS_SLUG_INVALID')
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
