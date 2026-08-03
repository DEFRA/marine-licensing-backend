import { describe, expect, it } from 'vitest'
import { isNonEmptyString } from './is-non-empty-string.js'

describe('isNonEmptyString', () => {
  it.each([
    ['plain string', 'MLA/2025/10001'],
    ['string with surrounding whitespace', '  MLA/2025/10001  ']
  ])('returns true for %s', (_label, value) => {
    expect(isNonEmptyString(value)).toBe(true)
  })

  it.each([
    ['empty string', ''],
    ['whitespace only', '   '],
    ['null', null],
    ['undefined', undefined],
    ['number', 1],
    ['object', { $ne: null }],
    ['array', ['MLA/2025/10001']],
    ['boolean', true]
  ])('returns false for %s', (_label, value) => {
    expect(isNonEmptyString(value)).toBe(false)
  })
})
