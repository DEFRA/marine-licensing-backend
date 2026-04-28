import joi from 'joi'
import { activityTypeFields } from './activity-type.js'

const schema = joi.object(activityTypeFields)

describe('activityType and activitySubType', () => {
  describe('valid activityType but missing activitySubType', () => {
    test('should fail when activitySubType is absent', () => {
      const { error } = schema.validate({ activityType: 'construction' })
      expect(error.message).toContain('ACTIVITY_SUBTYPE_REQUIRED')
    })

    test('should fail when activitySubType is empty string', () => {
      const { error } = schema.validate({
        activityType: 'construction',
        activitySubType: ''
      })
      expect(error.message).toContain('ACTIVITY_SUBTYPE_REQUIRED')
    })

    test('should pass with any non-empty activitySubType string and non-empty activities', () => {
      const { error } = schema.validate({
        activityType: 'construction',
        activitySubType: 'some-sub-type',
        activities: { selections: ['activity-one'] }
      })
      expect(error).toBeUndefined()
    })
  })

  describe('invalid activityType but valid activitySubType', () => {
    test('should fail when activityType is not a recognised value', () => {
      const { error } = schema.validate({
        activityType: 'invalid-type',
        activitySubType: 'some-sub-type'
      })
      expect(error.message).toContain('ACTIVITY_TYPE_REQUIRED')
    })

    test('should fail when activitySubType is set but activityType is absent', () => {
      const { error } = schema.validate({ activitySubType: 'some-sub-type' })
      expect(error.message).toContain('ACTIVITY_TYPE_REQUIRED')
    })

    test('should fail when activitySubType is set but activityType is empty', () => {
      const { error } = schema.validate({
        activityType: '',
        activitySubType: 'some-sub-type'
      })
      expect(error.message).toContain('ACTIVITY_TYPE_REQUIRED')
    })
  })
})

describe('activities', () => {
  test('should fail when activitySubType is set but activities is absent', () => {
    const { error } = schema.validate({
      activityType: 'construction',
      activitySubType: 'some-sub-type'
    })
    expect(error.message).toContain('ACTIVITIES_REQUIRED')
  })

  test('should fail when activitySubType is set and activities array is empty', () => {
    const { error } = schema.validate({
      activityType: 'construction',
      activitySubType: 'some-sub-type',
      activities: { selections: [] }
    })
    expect(error.message).toContain('ACTIVITIES_REQUIRED')
  })

  test('should pass when activitySubType is set and activities contains strings', () => {
    const { error } = schema.validate({
      activityType: 'construction',
      activitySubType: 'some-sub-type',
      activities: { selections: ['activity-one', 'activity-two'] }
    })
    expect(error).toBeUndefined()
  })

  test('should pass when activitySubType is absent and activities is absent', () => {
    const { error } = schema.validate({})
    expect(error).toBeUndefined()
  })

  test('should fail when activities includes "other" but otherActivity is absent', () => {
    const { error } = schema.validate({
      activityType: 'construction',
      activitySubType: 'some-sub-type',
      activities: { selections: ['other'] }
    })
    expect(error.message).toContain('ACTIVITIES_OTHER_REASON_REQUIRED')
  })

  test('should fail when activities includes "other" but otherActivity is empty string', () => {
    const { error } = schema.validate({
      activityType: 'construction',
      activitySubType: 'some-sub-type',
      activities: { selections: ['other'], otherActivity: '' }
    })
    expect(error.message).toContain('ACTIVITIES_OTHER_REASON_REQUIRED')
  })

  test('should fail when otherActivity exceeds max length', () => {
    const { error } = schema.validate({
      activityType: 'construction',
      activitySubType: 'some-sub-type',
      activities: { selections: ['other'], otherActivity: 'a'.repeat(1001) }
    })
    expect(error.message).toContain('ACTIVITIES_OTHER_REASON_MAX_LENGTH')
  })

  test('should pass when activities includes "other" and otherActivity is provided', () => {
    const { error } = schema.validate({
      activityType: 'construction',
      activitySubType: 'some-sub-type',
      activities: {
        selections: ['activity-one', 'other'],
        otherActivity: 'My other reason'
      }
    })
    expect(error).toBeUndefined()
  })
})
