import { vi } from 'vitest'
import { preferredDatesRangeSchema } from './preferred-dates.js'

describe('preferredDatesRangeSchema', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-21T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const validPayload = {
    start: { month: '05', year: '2026' },
    end: { month: '12', year: '2026' }
  }

  test('should pass with valid start and end dates', () => {
    const { error } = preferredDatesRangeSchema.validate(validPayload)
    expect(error).toBeUndefined()
  })

  test('should accept single digit months', () => {
    const { error } = preferredDatesRangeSchema.validate({
      start: { month: '5', year: '2026' },
      end: { month: '9', year: '2026' }
    })
    expect(error).toBeUndefined()
  })

  test('should fail when start is missing', () => {
    const { error } = preferredDatesRangeSchema.validate({
      end: validPayload.end
    })
    expect(error.message).toContain('PREFERRED_START_DATE_REQUIRED')
  })

  test('should fail when end is missing', () => {
    const { error } = preferredDatesRangeSchema.validate({
      start: validPayload.start
    })
    expect(error.message).toContain('PREFERRED_END_DATE_REQUIRED')
  })

  test('should fail when start month is invalid', () => {
    const { error } = preferredDatesRangeSchema.validate({
      start: { month: '13', year: '2026' },
      end: validPayload.end
    })
    expect(error.message).toContain('PREFERRED_START_MONTH_INVALID')
  })

  test('should fail when start year is not YYYY format', () => {
    const { error } = preferredDatesRangeSchema.validate({
      start: { month: '05', year: '26' },
      end: validPayload.end
    })
    expect(error.message).toContain('PREFERRED_START_YEAR_INVALID')
  })

  test('should fail when start date is before current month', () => {
    const { error } = preferredDatesRangeSchema.validate({
      start: { month: '04', year: '2026' },
      end: validPayload.end
    })
    expect(error.message).toContain('PREFERRED_START_DATE_TODAY_OR_FUTURE')
  })

  test('should fail when end date is before start date', () => {
    const { error } = preferredDatesRangeSchema.validate({
      start: { month: '08', year: '2026' },
      end: { month: '07', year: '2026' }
    })
    expect(error.message).toContain('PREFERRED_END_DATE_BEFORE_START_DATE')
  })

  test('should fail when end date is before start date across years', () => {
    const { error } = preferredDatesRangeSchema.validate({
      start: { month: '02', year: '2027' },
      end: { month: '12', year: '2026' }
    })
    expect(error.message).toContain('PREFERRED_END_DATE_BEFORE_START_DATE')
  })
})
