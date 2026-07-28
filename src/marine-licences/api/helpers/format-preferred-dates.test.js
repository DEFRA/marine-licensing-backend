import { formatPreferredDates } from './format-preferred-dates.js'

describe('formatPreferredDates', () => {
  it('formats start and end as "MMMM yyyy to MMMM yyyy"', () => {
    expect(
      formatPreferredDates({
        start: { month: '08', year: '2026' },
        end: { month: '11', year: '2026' }
      })
    ).toBe('August 2026 to November 2026')
  })

  it('handles single-digit month strings', () => {
    expect(
      formatPreferredDates({
        start: { month: '1', year: '2027' },
        end: { month: '12', year: '2027' }
      })
    ).toBe('January 2027 to December 2027')
  })

  it('returns null when preferredDates is missing', () => {
    expect(formatPreferredDates(null)).toBeNull()
    expect(formatPreferredDates(undefined)).toBeNull()
  })

  it('returns null when start or end is missing', () => {
    expect(
      formatPreferredDates({ start: { month: '08', year: '2026' } })
    ).toBeNull()
    expect(
      formatPreferredDates({ end: { month: '11', year: '2026' } })
    ).toBeNull()
  })
})
