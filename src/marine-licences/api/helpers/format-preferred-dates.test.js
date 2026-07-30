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

  it('returns null for non-numeric month or year', () => {
    expect(
      formatPreferredDates({
        start: { month: 'abc', year: '2026' },
        end: { month: '11', year: '2026' }
      })
    ).toBeNull()
    expect(
      formatPreferredDates({
        start: { month: '08', year: '2026' },
        end: { month: '11', year: 'abcd' }
      })
    ).toBeNull()
  })

  it('returns null for empty month or year', () => {
    expect(
      formatPreferredDates({
        start: { month: '', year: '2026' },
        end: { month: '11', year: '2026' }
      })
    ).toBeNull()
    expect(
      formatPreferredDates({
        start: { month: '08', year: '2026' },
        end: { month: '11', year: '' }
      })
    ).toBeNull()
  })

  it('returns null for out-of-range month', () => {
    expect(
      formatPreferredDates({
        start: { month: '13', year: '2026' },
        end: { month: '11', year: '2026' }
      })
    ).toBeNull()
    expect(
      formatPreferredDates({
        start: { month: '08', year: '2026' },
        end: { month: '0', year: '2026' }
      })
    ).toBeNull()
  })
})
