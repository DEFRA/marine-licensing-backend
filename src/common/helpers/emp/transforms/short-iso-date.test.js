import { shortIsoDate } from './short-iso-date.js'

describe('shortIsoDate', () => {
  it('should format Date object to short ISO date format (YYYY-MM-DD)', () => {
    const date = new Date('2024-03-15T10:30:00.000Z')
    const result = shortIsoDate(date)
    expect(result).toBe('2024-03-15')
  })

  it('should handle dates at the start of the year', () => {
    const date = new Date('2024-01-01T00:00:00.000Z')
    const result = shortIsoDate(date)
    expect(result).toBe('2024-01-01')
  })

  it('should handle dates at the end of the year', () => {
    const date = new Date('2024-12-31T23:59:59.000Z')
    const result = shortIsoDate(date)
    expect(result).toBe('2024-12-31')
  })

  it('should handle single digit days and months', () => {
    const date = new Date('2024-05-09T12:00:00.000Z')
    const result = shortIsoDate(date)
    expect(result).toBe('2024-05-09')
  })

  it('should handle double digit days and months', () => {
    const date = new Date('2024-11-22T12:00:00.000Z')
    const result = shortIsoDate(date)
    expect(result).toBe('2024-11-22')
  })

  it('should handle leap year dates', () => {
    const date = new Date('2024-02-29T12:00:00.000Z')
    const result = shortIsoDate(date)
    expect(result).toBe('2024-02-29')
  })

  it('should handle Date object created from ISO datetime with timezone offset', () => {
    const date = new Date('2025-10-29T12:11:46.373+00:00')
    const result = shortIsoDate(date)
    expect(result).toBe('2025-10-29')
  })

  it('should handle Date object created from ISO date string in YYYY-MM-DD format', () => {
    const date = new Date('2024-03-15')
    const result = shortIsoDate(date)
    expect(result).toBe('2024-03-15')
  })

  it('should handle Date object with single digit month and day', () => {
    const date = new Date('2024-05-09')
    const result = shortIsoDate(date)
    expect(result).toBe('2024-05-09')
  })

  it('should handle year boundary dates', () => {
    const date = new Date('2024-12-31')
    const result = shortIsoDate(date)
    expect(result).toBe('2024-12-31')
  })
})
