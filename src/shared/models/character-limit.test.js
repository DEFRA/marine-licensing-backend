import joi from 'joi'
import { countCharacters, withCharacterLimit } from './character-limit.js'

describe('countCharacters', () => {
  it.each([
    ['an emoji with a skin tone', '👍🏽', 1],
    ['a flag', '🇬🇧', 1],
    ['a decomposed accented letter', 'e\u0301', 1],
    ['a CRLF line break as one character', 'a\r\nb', 3]
  ])('counts %s', (_description, text, expected) => {
    expect(countCharacters(text)).toBe(expected)
  })
})

describe('withCharacterLimit', () => {
  const schema = withCharacterLimit(joi.string(), 1000)

  it.each([
    ['1,000 emoji', '👍🏽'.repeat(1000)],
    ['999 characters with CRLF line breaks', 'a\r\n'.repeat(499) + 'a']
  ])('accepts %s', (_description, value) => {
    expect(schema.validate(value).error).toBeUndefined()
  })

  it.each([
    ['1,001 plain characters', 'a'.repeat(1001)],
    ['1,000 characters followed by an emoji', 'a'.repeat(1000) + '👍🏽'],
    [
      'fewer than 1,000 characters stored in more than 10,000 code units',
      ('a' + '\u0301'.repeat(20)).repeat(500)
    ]
  ])('rejects %s as too long', (_description, value) => {
    expect(schema.validate(value).error.details[0].type).toBe('string.max')
  })
})
