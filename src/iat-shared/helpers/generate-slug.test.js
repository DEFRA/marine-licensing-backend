import { describe, expect, test } from 'vitest'
import { generateSlug } from './generate-slug.js'

describe('generateSlug', () => {
  test('returns a 22-character base64url string', () => {
    const slug = generateSlug()
    expect(slug).toMatch(/^[A-Za-z0-9_-]{22}$/)
  })

  test('returns a different value on each call', () => {
    const a = generateSlug()
    const b = generateSlug()
    expect(a).not.toBe(b)
  })
})
