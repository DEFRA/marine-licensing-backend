import { describe, it, expect } from 'vitest'
import { equal } from './utils.js'

describe('equal', () => {
  it('should return true for identical numbers', () => {
    expect(equal(1, 1)).toBe(true)
    expect(equal(0, 0)).toBe(true)
    expect(equal(-5, -5)).toBe(true)
  })

  it('should return true for numbers differing by less than EPSILON', () => {
    const x = 1.0
    const y = 1.0 + Number.EPSILON / 2
    expect(equal(x, y)).toBe(true)
  })
})
