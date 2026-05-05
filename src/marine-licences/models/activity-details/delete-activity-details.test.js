import { ObjectId } from 'mongodb'
import { deleteActivityDetailsSchema } from './delete-activity-details.js'

describe('deleteActivityDetailsSchema', () => {
  const validPayload = {
    id: new ObjectId().toHexString(),
    siteIndex: 0,
    activityIndex: 0
  }

  test('should pass with valid payload', () => {
    const { error } = deleteActivityDetailsSchema.validate(validPayload)
    expect(error).toBeUndefined()
  })

  describe('siteIndex', () => {
    test('should fail when siteIndex is missing', () => {
      const { error } = deleteActivityDetailsSchema.validate({
        ...validPayload,
        siteIndex: undefined
      })
      expect(error.message).toContain('SITE_INDEX_REQUIRED')
    })

    test('should fail when siteIndex is negative', () => {
      const { error } = deleteActivityDetailsSchema.validate({
        ...validPayload,
        siteIndex: -1
      })
      expect(error.message).toContain('SITE_INDEX_INVALID')
    })

    test('should fail when siteIndex is not an integer', () => {
      const { error } = deleteActivityDetailsSchema.validate({
        ...validPayload,
        siteIndex: 1.5
      })
      expect(error.message).toContain('SITE_INDEX_INVALID')
    })
  })

  describe('activityIndex', () => {
    test('should fail when activityIndex is missing', () => {
      const { error } = deleteActivityDetailsSchema.validate({
        ...validPayload,
        activityIndex: undefined
      })
      expect(error.message).toContain('ACTIVITY_INDEX_REQUIRED')
    })

    test('should fail when activityIndex is negative', () => {
      const { error } = deleteActivityDetailsSchema.validate({
        ...validPayload,
        activityIndex: -1
      })
      expect(error.message).toContain('ACTIVITY_INDEX_INVALID')
    })

    test('should fail when activityIndex is not an integer', () => {
      const { error } = deleteActivityDetailsSchema.validate({
        ...validPayload,
        activityIndex: 1.5
      })
      expect(error.message).toContain('ACTIVITY_INDEX_INVALID')
    })
  })

  describe('id', () => {
    test('should fail when id is missing', () => {
      const { error } = deleteActivityDetailsSchema.validate({
        ...validPayload,
        id: undefined
      })
      expect(error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
    })

    test('should fail when id is not a valid hex string', () => {
      const { error } = deleteActivityDetailsSchema.validate({
        ...validPayload,
        id: 'z'.repeat(24)
      })
      expect(error.message).toContain('MARINE_LICENCE_ID_INVALID')
    })
  })
})
