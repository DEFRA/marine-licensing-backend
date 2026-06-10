import { describe, expect, test } from 'vitest'
import { outcomeDocumentSlugParams } from './iat-outcome-document.js'

describe('outcomeDocumentSlugParams', () => {
  test('accepts a 22-char base64url slug', () => {
    expect(
      outcomeDocumentSlugParams.validate({ slug: 'a'.repeat(22) }).error
    ).toBeUndefined()
  })
  test('rejects short slugs', () => {
    expect(
      outcomeDocumentSlugParams.validate({ slug: 'short' }).error
    ).toBeDefined()
  })
})
