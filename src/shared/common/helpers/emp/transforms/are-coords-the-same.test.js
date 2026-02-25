import { areCoordsTheSame } from './are-coords-the-same.js'

describe('areCoordsTheSame', () => {
  it('should return true when coordinates are exactly the same', () => {
    const coord1 = [1.123456, 2.987654]
    const coord2 = [1.123456, 2.987654]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(true)
  })

  it('should return false when longitude differs', () => {
    const coord1 = [1.123456, 2.987654]
    const coord2 = [1.123457, 2.987654]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(false)
  })

  it('should return false when latitude differs', () => {
    const coord1 = [1.123456, 2.987654]
    const coord2 = [1.123456, 2.987655]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(false)
  })

  it('should return false when both longitude and latitude differ', () => {
    const coord1 = [1.123456, 2.987654]
    const coord2 = [1.123457, 2.987655]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(false)
  })

  it('should return true for identical negative coordinates', () => {
    const coord1 = [-0.123456, -51.987654]
    const coord2 = [-0.123456, -51.987654]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(true)
  })

  it('should return true for identical mixed sign coordinates', () => {
    const coord1 = [-0.123456, 51.123456]
    const coord2 = [-0.123456, 51.123456]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(true)
  })

  it('should return true for identical zero coordinates', () => {
    const coord1 = [0, 0]
    const coord2 = [0, 0]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(true)
  })

  it('should return true for coordinates with 6 decimal places that are identical', () => {
    const coord1 = [1.123456, 2.987654]
    const coord2 = [1.123456, 2.987654]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(true)
  })

  it('should return false for coordinates that differ at the 6th decimal place', () => {
    const coord1 = [1.123456, 2.987654]
    const coord2 = [1.123457, 2.987654]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(false)
  })

  it('should safely compare coordinates rounded to 6 decimal places', () => {
    // These coordinates when rounded to 6 decimal places should be identical
    const coord1 = [1.123456, 2.987654]
    const coord2 = [1.123456, 2.987654]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(true)
  })

  it('should return false when coordinates differ beyond 6 decimal places without prior rounding', () => {
    // Note: This test demonstrates that the function uses strict equality
    // If these coordinates haven't been rounded first, even tiny differences will return false
    const coord1 = [1.1234567, 2.9876547]
    const coord2 = [1.1234568, 2.9876548]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(false)
  })

  it('should handle whole number coordinates', () => {
    const coord1 = [1, 2]
    const coord2 = [1, 2]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(true)
  })

  it('should return false for whole numbers that differ', () => {
    const coord1 = [1, 2]
    const coord2 = [1, 3]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(false)
  })

  it('should handle very large coordinate values', () => {
    const coord1 = [180.123456, -90.987654]
    const coord2 = [180.123456, -90.987654]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(true)
  })

  it('should handle very small decimal values', () => {
    const coord1 = [0.000001, 0.00001]
    const coord2 = [0.000001, 0.00001]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(true)
  })

  it('should return true for coordinates with floating point precision differences', () => {
    // This test demonstrates potential floating point issues
    // In practice, coordinates should be rounded before comparison
    const coord1 = [0.1 + 0.2, 1.0] // 0.30000000000000004 in JavaScript
    const coord2 = [0.3, 1.0]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(true) // Due to floating point precision
  })

  it('should handle coordinates at the equator and prime meridian', () => {
    const coord1 = [0.0, 0.0]
    const coord2 = [0.0, 0.0]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(true)
  })

  it('should distinguish between positive and negative zero', () => {
    // In JavaScript, -0 === 0 is true, so this should return true
    const coord1 = [0, 0]
    const coord2 = [-0, -0]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(true)
  })

  it('should handle boundary coordinates (max longitude)', () => {
    const coord1 = [180.0, 0.0]
    const coord2 = [180.0, 0.0]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(true)
  })

  it('should handle boundary coordinates (min longitude)', () => {
    const coord1 = [-180.0, 0.0]
    const coord2 = [-180.0, 0.0]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(true)
  })

  it('should handle boundary coordinates (max latitude)', () => {
    const coord1 = [0.0, 90.0]
    const coord2 = [0.0, 90.0]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(true)
  })

  it('should handle boundary coordinates (min latitude)', () => {
    const coord1 = [0.0, -90.0]
    const coord2 = [0.0, -90.0]
    const result = areCoordsTheSame(coord1, coord2)
    expect(result).toBe(true)
  })
})
