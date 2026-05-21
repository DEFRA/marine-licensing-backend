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
    start: '2026-05-21',
    end: '2026-12-01'
  }

  test('should pass with valid start and end dates', () => {
    const { error } = preferredDatesRangeSchema.validate(validPayload)
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

  test('should fail when start date is invalid', () => {
    const { error } = preferredDatesRangeSchema.validate({
      start: 'not-a-date',
      end: validPayload.end
    })
    expect(error.message).toContain('PREFERRED_START_DATE_INVALID')
  })

  test('should fail when end date is invalid', () => {
    const { error } = preferredDatesRangeSchema.validate({
      start: validPayload.start,
      end: 'not-a-date'
    })
    expect(error.message).toContain('PREFERRED_END_DATE_INVALID')
  })

  test('should fail when start date is before today', () => {
    const { error } = preferredDatesRangeSchema.validate({
      start: '2026-05-20',
      end: validPayload.end
    })
    expect(error.message).toContain('PREFERRED_START_DATE_TODAY_OR_FUTURE')
  })

  test('should fail when end date is before start date', () => {
    const { error } = preferredDatesRangeSchema.validate({
      start: '2026-08-01',
      end: '2026-07-01'
    })
    expect(error.message).toContain('PREFERRED_END_DATE_BEFORE_START_DATE')
  })

  test('should fail when end date is before start date across years', () => {
    const { error } = preferredDatesRangeSchema.validate({
      start: '2027-02-01',
      end: '2026-12-01'
    })
    expect(error.message).toContain('PREFERRED_END_DATE_BEFORE_START_DATE')
  })
})
