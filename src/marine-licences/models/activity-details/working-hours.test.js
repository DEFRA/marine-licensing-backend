import joi from 'joi'

import { workingHoursSchema } from './working-hours.js'

const schema = joi.object({ workingHours: workingHoursSchema })

describe('workingHours', () => {
  test('should fail when workingHours is above max length', () => {
    const longString = 't'.repeat(1_000 + 1)
    const { error } = schema.validate({ workingHours: longString })
    expect(error.message).toContain('WORKING_HOURS_MAX_LENGTH')
  })

  test('should fail when workingHours is null', () => {
    const { error } = schema.validate({ workingHours: null })
    expect(error.message).toContain('WORKING_HOURS_REQUIRED')
  })

  test('should pass with valid text', () => {
    const { error } = schema.validate({ workingHours: 'Valid' })
    expect(error).toBeUndefined()
  })
})
