import { roundCoordinates } from './round-coordinates.js'

describe('roundCoordinates', () => {
  it('should round coordinates to 6 decimal places', () => {
    const coordinates = [1.123456789, 2.987654321]
    const result = roundCoordinates(coordinates)
    expect(result).toEqual([1.123457, 2.987654])
  })

  it('should handle negative coordinates', () => {
    const coordinates = [-0.123456789, -51.987654321]
    const result = roundCoordinates(coordinates)
    expect(result).toEqual([-0.123457, -51.987654])
  })

  it('should handle mixed positive and negative coordinates', () => {
    const coordinates = [-0.123456, 51.123456]
    const result = roundCoordinates(coordinates)
    expect(result).toEqual([-0.123456, 51.123456])
  })

  it('should handle coordinates that do not need rounding', () => {
    const coordinates = [1.12, 2.34]
    const result = roundCoordinates(coordinates)
    expect(result).toEqual([1.12, 2.34])
  })

  it('should handle zero coordinates', () => {
    const coordinates = [0, 0]
    const result = roundCoordinates(coordinates)
    expect(result).toEqual([0, 0])
  })

  it('should handle coordinates with trailing zeros after rounding', () => {
    const coordinates = [1.0000001, 2.0000004]
    const result = roundCoordinates(coordinates)
    expect(result).toEqual([1, 2])
  })

  it('should round up correctly when last digit is 5 or greater', () => {
    const coordinates = [1.1234565, 2.9876545]
    const result = roundCoordinates(coordinates)
    expect(result).toEqual([1.123457, 2.987655])
  })

  it('should round down correctly when last digit is less than 5', () => {
    const coordinates = [1.1234564, 2.9876544]
    const result = roundCoordinates(coordinates)
    expect(result).toEqual([1.123456, 2.987654])
  })

  it('should handle very large coordinate values', () => {
    const coordinates = [180.123456789, -90.987654321]
    const result = roundCoordinates(coordinates)
    expect(result).toEqual([180.123457, -90.987654])
  })

  it('should handle very small decimal values', () => {
    const coordinates = [0.0000012345, 0.0000098765]
    const result = roundCoordinates(coordinates)
    expect(result).toEqual([0.000001, 0.00001])
  })

  it('should return numbers not strings', () => {
    const coordinates = [1.123456789, 2.987654321]
    const result = roundCoordinates(coordinates)
    expect(typeof result[0]).toBe('number')
    expect(typeof result[1]).toBe('number')
  })
})
