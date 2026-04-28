import joi from 'joi'
import { activityDurationSchema } from './activity-duration.js'

const schema = joi.object({ activityDuration: activityDurationSchema })

describe('activityDuration', () => {
  test('should pass with an empty object', () => {
    const { error } = schema.validate({ activityDuration: {} })
    expect(error).toBeUndefined()
  })

  test('should pass with valid years and months', () => {
    const { error } = schema.validate({
      activityDuration: { years: '2', months: '3' }
    })
    expect(error).toBeUndefined()
  })

  test('should fail when years is absent and months is present', () => {
    const { error } = schema.validate({ activityDuration: { months: '3' } })
    expect(error.message).toContain('YEARS_REQUIRED')
  })

  test('should fail with MONTHS_REQUIRED when years is present but months is absent', () => {
    const { error } = schema.validate({ activityDuration: { years: '2' } })
    expect(error.message).toContain('MONTHS_REQUIRED')
  })

  test('should fail with DURATION_BOTH_ZERO when years and months are both 0', () => {
    const { error } = schema.validate({
      activityDuration: { years: '0', months: '0' }
    })
    expect(error.message).toContain('DURATION_BOTH_ZERO')
  })

  test('should fail with MONTHS_NOT_VALID when months is out of range', () => {
    const { error } = schema.validate({
      activityDuration: { years: '1', months: '12' }
    })
    expect(error.message).toContain('MONTHS_NOT_VALID')
  })
})
