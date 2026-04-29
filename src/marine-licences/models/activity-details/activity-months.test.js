import joi from 'joi'
import { activityMonthsSchema } from './activity-months.js'

const schema = joi.object({ activityMonths: activityMonthsSchema })

describe('activityMonths', () => {
  test('should pass with correct values', () => {
    const { error } = schema.validate({
      activityMonths: { months: 'yes', details: 'Test reason' }
    })
    expect(error).toBeUndefined()
  })

  test('should fail when reason not provided or blank', () => {
    const { error: missingError } = schema.validate({
      activityMonths: { months: 'yes' }
    })
    expect(missingError.message).toContain(
      'MONTHS_OF_ACTIVITY_DETAILS_REQUIRED'
    )

    const { error: blankError } = schema.validate({
      activityMonths: { months: 'yes', details: '' }
    })
    expect(blankError.message).toContain('MONTHS_OF_ACTIVITY_DETAILS_REQUIRED')
  })

  test('should fail when reason length exceeds limit value', () => {
    const longString = 't'.repeat(1_000 + 1)
    const { error } = schema.validate({
      activityMonths: { months: 'yes', details: longString }
    })
    expect(error.message).toContain('MONTHS_OF_ACTIVITY_DETAILS_MAX_LENGTH')
  })
})
