import { ObjectId } from 'mongodb'
import {
  activityDetailsSchema,
  activityItemSchema
} from './activity-details.js'

describe('activityDetailsSchema', () => {
  it.each([
    ['missing id', { siteIndex: 0 }, 'MARINE_LICENCE_ID_REQUIRED'],
    [
      'missing siteIndex',
      { id: new ObjectId().toHexString() },
      'SITE_INDEX_REQUIRED'
    ],
    [
      'negative siteIndex',
      { id: new ObjectId().toHexString(), siteIndex: -1 },
      'SITE_INDEX_INVALID'
    ],
    [
      'non-integer siteIndex',
      { id: new ObjectId().toHexString(), siteIndex: 1.5 },
      'SITE_INDEX_INVALID'
    ]
  ])('should fail when %s', (_label, input, expectedMessage) => {
    const { error } = activityDetailsSchema.validate(input)
    expect(error.message).toContain(expectedMessage)
  })

  it('should pass with a valid id and siteIndex', () => {
    const { error } = activityDetailsSchema.validate({
      id: new ObjectId().toHexString(),
      siteIndex: 0
    })
    expect(error).toBeUndefined()
  })
})

describe('activityItemSchema', () => {
  describe('valid outcomes', () => {
    test('should pass with a blank object', () => {
      const { error } = activityItemSchema.validate({})
      expect(error).toBeUndefined()
    })

    test.each(['construction', 'deposit', 'removal'])(
      'should pass with activityType, activitySubType and non-empty activities',
      (activityType) => {
        const { error } = activityItemSchema.validate({
          activityType,
          activitySubType: 'some-sub-type',
          activities: { selections: ['activity-one'] }
        })
        expect(error).toBeUndefined()
      }
    )

    test('should pass with activities containing multiple strings', () => {
      const { error } = activityItemSchema.validate({
        activityType: 'construction',
        activitySubType: 'some-sub-type',
        activities: {
          selections: ['activity-one', 'activity-two']
        }
      })
      expect(error).toBeUndefined()
    })
  })

  describe('valid activityType but missing activitySubType', () => {
    test('should fail when activitySubType is absent', () => {
      const { error } = activityItemSchema.validate({
        activityType: 'construction'
      })
      expect(error.message).toContain('ACTIVITY_SUBTYPE_REQUIRED')
    })

    test('should fail when activitySubType is empty string', () => {
      const { error } = activityItemSchema.validate({
        activityType: 'construction',
        activitySubType: ''
      })
      expect(error.message).toContain('ACTIVITY_SUBTYPE_REQUIRED')
    })

    test('should pass with any non-empty activitySubType string and non-empty activities', () => {
      const { error } = activityItemSchema.validate({
        activityType: 'construction',
        activitySubType: 'some-sub-type',
        activities: { selections: ['activity-one'] }
      })
      expect(error).toBeUndefined()
    })
  })

  describe('invalid activityType but valid activitySubType', () => {
    test('should fail when activityType is not a recognised value', () => {
      const { error } = activityItemSchema.validate({
        activityType: 'invalid-type',
        activitySubType: 'some-sub-type'
      })
      expect(error.message).toContain('ACTIVITY_TYPE_REQUIRED')
    })

    test('should fail when activitySubType is set but activityType is absent', () => {
      const { error } = activityItemSchema.validate({
        activitySubType: 'some-sub-type'
      })
      expect(error.message).toContain('ACTIVITY_TYPE_REQUIRED')
    })

    test('should fail when activitySubType is set but activityType is empty', () => {
      const { error } = activityItemSchema.validate({
        activityType: '',
        activitySubType: 'some-sub-type'
      })
      expect(error.message).toContain('ACTIVITY_TYPE_REQUIRED')
    })
  })

  describe('activities', () => {
    test('should fail when activitySubType is set but activities is absent', () => {
      const { error } = activityItemSchema.validate({
        activityType: 'construction',
        activitySubType: 'some-sub-type'
      })
      expect(error.message).toContain('ACTIVITIES_REQUIRED')
    })

    test('should fail when activitySubType is set and activities array is empty', () => {
      const { error } = activityItemSchema.validate({
        activityType: 'construction',
        activitySubType: 'some-sub-type',
        activities: { selections: [] }
      })
      expect(error.message).toContain('ACTIVITIES_REQUIRED')
    })

    test('should pass when activitySubType is set and activities contains strings', () => {
      const { error } = activityItemSchema.validate({
        activityType: 'construction',
        activitySubType: 'some-sub-type',
        activities: {
          selections: ['activity-one', 'activity-two']
        }
      })
      expect(error).toBeUndefined()
    })

    test('should pass when activitySubType is absent and activities is absent', () => {
      const { error } = activityItemSchema.validate({})
      expect(error).toBeUndefined()
    })

    test('should fail when activities includes "other" but otherActivity is absent', () => {
      const { error } = activityItemSchema.validate({
        activityType: 'construction',
        activitySubType: 'some-sub-type',
        activities: { selections: ['other'] }
      })
      expect(error.message).toContain('ACTIVITIES_OTHER_REASON_REQUIRED')
    })

    test('should fail when activities includes "other" but otherActivity is empty string', () => {
      const { error } = activityItemSchema.validate({
        activityType: 'construction',
        activitySubType: 'some-sub-type',
        activities: { selections: ['other'], otherActivity: '' }
      })
      expect(error.message).toContain('ACTIVITIES_OTHER_REASON_REQUIRED')
    })

    test('should fail when otherActivity exceeds max length', () => {
      const { error } = activityItemSchema.validate({
        activityType: 'construction',
        activitySubType: 'some-sub-type',
        activities: { selections: ['other'], otherActivity: 'a'.repeat(1001) }
      })
      expect(error.message).toContain('ACTIVITIES_OTHER_REASON_MAX_LENGTH')
    })

    test('should pass when activities includes "other" and otherActivity is provided', () => {
      const { error } = activityItemSchema.validate({
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

  describe('nulls and empties', () => {
    test('should pass when activityType is empty string', () => {
      const { error } = activityItemSchema.validate({ activityType: '' })
      expect(error).toBeUndefined()
    })

    test('should pass when activityType is absent', () => {
      const { error } = activityItemSchema.validate({})
      expect(error).toBeUndefined()
    })

    test('should pass when activitySubType is absent and activityType is empty', () => {
      const { error } = activityItemSchema.validate({ activityType: '' })
      expect(error).toBeUndefined()
    })
  })
})
