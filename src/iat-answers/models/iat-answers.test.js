import { describe, expect, it } from 'vitest'
import { iatAnswersSlugParams } from './iat-answers.js'

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
