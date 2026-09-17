import { describe, expect, test } from 'vitest'
import {
  toApplicationReference,
  toUrlSafeApplicationReference
} from './url-transform.js'

describe('toApplicationReference', () => {
  test('converts a url-safe reference back to an application reference', () => {
    expect(toApplicationReference('ML-2024-001')).toBe('ML/2024/001')
  })
})

describe('toUrlSafeApplicationReference', () => {
  test('converts an application reference to a url-safe form', () => {
    expect(toUrlSafeApplicationReference('ML/2024/001')).toBe('ML-2024-001')
  })
})
