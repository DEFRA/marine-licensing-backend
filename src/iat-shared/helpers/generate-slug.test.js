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

  test('produces a UUIDv7 (version 7, variant 10) — protects index locality on the slug field', () => {
    const slug = generateSlug()
    const bytes = Buffer.from(slug, 'base64url')
    expect(bytes.length).toBe(16)
    expect(bytes[6] >> 4).toBe(0x7)
    expect(bytes[8] >> 6).toBe(0b10)
  })
})
