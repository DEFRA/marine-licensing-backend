import { ObjectId } from 'mongodb'
import { activityDetailsSchema } from './activity-details.js'

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
