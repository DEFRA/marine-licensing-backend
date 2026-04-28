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

describe('activityItemSchema - valid outcomes', () => {
  test('should pass with a blank object', () => {
    const { error } = activityItemSchema.validate({})
    expect(error).toBeUndefined()
  })

  test.each(['construction', 'deposit', 'removal'])(
    'should pass with activityType %s, activitySubType and non-empty activities',
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
      activities: { selections: ['activity-one', 'activity-two'] }
    })
    expect(error).toBeUndefined()
  })
})

describe('activityItemSchema - nulls and empties', () => {
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
