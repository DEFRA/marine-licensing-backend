import { describe, expect, it } from 'vitest'
import { generateSlug } from './generate-slug.js'

describe('generateSlug', () => {
  it('returns a 22-character base64url string', () => {
    const slug = generateSlug()
    expect(slug).toMatch(/^[A-Za-z0-9_-]{22}$/)
  })

  it('produces a UUIDv7 (version 7, variant 10)', () => {
    const slug = generateSlug()
    const bytes = Buffer.from(slug, 'base64url')
    expect(bytes.length).toBe(16)
    expect(bytes[6] >> 4).toBe(0x7)
    expect(bytes[8] >> 6).toBe(0b10)
  })

  it('does not collide across many calls', () => {
    const slugs = new Set()
    for (let i = 0; i < 1000; i++) {
      slugs.add(generateSlug())
    }
    expect(slugs.size).toBe(1000)
  })
})
