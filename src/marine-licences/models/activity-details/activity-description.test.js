import joi from 'joi'
import {
  activityDescriptionSchema,
  ACTIVITY_DESCRIPTION_MAX_LENGTH
} from './activity-description.js'

const schema = joi.object({ activityDescription: activityDescriptionSchema })

describe('activityDescription', () => {
  test('should fail when activityDescription is above max length', () => {
    const longString = 't'.repeat(ACTIVITY_DESCRIPTION_MAX_LENGTH + 1)
    const { error } = schema.validate({ activityDescription: longString })
    expect(error.message).toContain('ACTIVITY_DESCRIPTION_MAX_LENGTH')
  })

  test('should fail when activityDescription is null', () => {
    const { error } = schema.validate({ activityDescription: null })
    expect(error.message).toContain('ACTIVITY_DESCRIPTION_REQUIRED')
  })
})
