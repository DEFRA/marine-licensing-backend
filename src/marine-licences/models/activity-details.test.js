import { ObjectId } from 'mongodb'
import {
  ACTIVITY_DESCRIPTION_MAX_LENGTH,
  activityDetailsSchema,
  activityItemSchema
} from './activity-details.js'
import { createActivityDetails } from '../api/helpers/create-empty-activity-details.js'

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
  const createdActivityDetails = createActivityDetails()

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

  describe('activityType and activitySubType', () => {
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
  })

  describe('activityDescription', () => {
    test('should fail when activityDetails is above max length', () => {
      const longString = 'test'.repeat(ACTIVITY_DESCRIPTION_MAX_LENGTH + 1)
      const { error } = activityItemSchema.validate({
        ...createdActivityDetails,
        activityDescription: longString
      })

      expect(error.message).toContain('ACTIVITY_DESCRIPTION_MAX_LENGTH')
    })

    test('should fail when activityDetails is null', () => {
      const { error } = activityItemSchema.validate({
        ...createdActivityDetails,
        activityDescription: null
      })
      expect(error.message).toContain('ACTIVITY_DESCRIPTION_REQUIRED')
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

  describe('activityDuration', () => {
    test('should pass with an empty object', () => {
      const { error } = activityItemSchema.validate({ activityDuration: {} })
      expect(error).toBeUndefined()
    })

    test('should pass with valid years and months', () => {
      const { error } = activityItemSchema.validate({
        activityDuration: { years: '2', months: '3' }
      })
      expect(error).toBeUndefined()
    })

    test('should fail when years is absent and months is present', () => {
      const { error } = activityItemSchema.validate({
        activityDuration: { months: '3' }
      })
      expect(error.message).toContain('YEARS_REQUIRED')
    })

    test('should fail with MONTHS_REQUIRED when years is present but months is absent', () => {
      const { error } = activityItemSchema.validate({
        activityDuration: { years: '2' }
      })
      expect(error.message).toContain('MONTHS_REQUIRED')
    })

    test('should fail with DURATION_BOTH_ZERO when years and months are both 0', () => {
      const { error } = activityItemSchema.validate({
        activityDuration: { years: '0', months: '0' }
      })
      expect(error.message).toContain('DURATION_BOTH_ZERO')
    })

    test('should fail with MONTHS_NOT_VALID when months is out of range', () => {
      const { error } = activityItemSchema.validate({
        activityDuration: { years: '1', months: '12' }
      })
      expect(error.message).toContain('MONTHS_NOT_VALID')
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
      const { error } = activityItemSchema.validate({
        activityType: ''
      })
      expect(error).toBeUndefined()
    })
  })
})
