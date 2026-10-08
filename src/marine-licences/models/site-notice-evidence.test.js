import { vi } from 'vitest'
import { updateSiteNoticeEvidenceSchema } from './site-notice-evidence.js'

const validId = 'a'.repeat(24)

const photo = {
  uploadedFile: { filename: 'notice.jpg' },
  s3Location: {
    s3Bucket: 'mmo-uploads',
    s3Key: 'notice-key',
    checksumSha256: 'abc123'
  }
}

describe('updateSiteNoticeEvidenceSchema', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-21T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const validate = (overrides = {}) =>
    updateSiteNoticeEvidenceSchema.validate({
      id: validId,
      evidenceIndex: 0,
      ...overrides
    })

  test('should pass with a location name', () => {
    const { error } = validate({ locationName: 'North pier' })
    expect(error).toBeUndefined()
  })

  test('should pass with a location name of 250 characters', () => {
    const { error } = validate({ locationName: 'a'.repeat(250) })
    expect(error).toBeUndefined()
  })

  test('should fail when location name is longer than 250 characters', () => {
    const { error } = validate({ locationName: 'a'.repeat(251) })
    expect(error.message).toContain('LOCATION_NAME_MAX_LENGTH')
  })

  test('should fail when location name is empty', () => {
    const { error } = validate({ locationName: '' })
    expect(error.message).toContain('LOCATION_NAME_REQUIRED')
  })

  test('should fail when location name is only whitespace', () => {
    const { error } = validate({ locationName: '   ' })
    expect(error.message).toContain('LOCATION_NAME_REQUIRED')
  })

  test('should pass with today', () => {
    const { error } = validate({
      dateDisplayed: { day: '21', month: '05', year: '2026' }
    })
    expect(error).toBeUndefined()
  })

  test('should pass with a past date and single digit day and month', () => {
    const { error } = validate({
      dateDisplayed: { day: '5', month: '1', year: '2020' }
    })
    expect(error).toBeUndefined()
  })

  test('should fail when the date is in the future', () => {
    const { error } = validate({
      dateDisplayed: { day: '22', month: '05', year: '2026' }
    })
    expect(error.message).toContain('DATE_DISPLAYED_DATE_TODAY_OR_PAST')
  })

  test('should fail when the date is not a real day', () => {
    const { error } = validate({
      dateDisplayed: { day: '31', month: '04', year: '2026' }
    })
    expect(error.message).toContain('DATE_DISPLAYED_DATE_INVALID')
  })

  test('should fail when day is missing', () => {
    const { error } = validate({
      dateDisplayed: { month: '05', year: '2026' }
    })
    expect(error.message).toContain('DATE_DISPLAYED_DAY_REQUIRED')
  })

  test('should fail when month is missing', () => {
    const { error } = validate({
      dateDisplayed: { day: '21', year: '2026' }
    })
    expect(error.message).toContain('DATE_DISPLAYED_MONTH_REQUIRED')
  })

  test('should fail when year is missing', () => {
    const { error } = validate({
      dateDisplayed: { day: '21', month: '05' }
    })
    expect(error.message).toContain('DATE_DISPLAYED_YEAR_REQUIRED')
  })

  test('should fail when month is invalid', () => {
    const { error } = validate({
      dateDisplayed: { day: '21', month: '13', year: '2026' }
    })
    expect(error.message).toContain('DATE_DISPLAYED_MONTH_INVALID')
  })

  test('should fail when year is not YYYY', () => {
    const { error } = validate({
      dateDisplayed: { day: '21', month: '05', year: '26' }
    })
    expect(error.message).toContain('DATE_DISPLAYED_YEAR_INVALID')
  })

  test('should pass with a close-up photo', () => {
    const { error } = validate({ closeUpPhoto: photo })
    expect(error).toBeUndefined()
  })

  test('should pass with a position photo', () => {
    const { error } = validate({ positionPhoto: photo })
    expect(error).toBeUndefined()
  })

  test('should fail when a photo is missing the uploaded file', () => {
    const { error } = validate({
      closeUpPhoto: { s3Location: photo.s3Location }
    })
    expect(error.message).toContain('UPLOADED_FILE_REQUIRED')
  })

  test('should fail when a photo is missing the s3 key', () => {
    const { error } = validate({
      positionPhoto: {
        uploadedFile: photo.uploadedFile,
        s3Location: { s3Bucket: 'mmo-uploads', checksumSha256: 'abc123' }
      }
    })
    expect(error.message).toContain('S3_KEY_REQUIRED')
  })

  test('should fail when no evidence field is present', () => {
    const { error } = validate()
    expect(error.message).toContain('SITE_NOTICE_EVIDENCE_REQUIRED')
  })

  test('should fail when evidence index is missing', () => {
    const { error } = updateSiteNoticeEvidenceSchema.validate({
      id: validId,
      locationName: 'North pier'
    })
    expect(error.message).toContain('EVIDENCE_INDEX_REQUIRED')
  })

  test('should fail when evidence index is negative', () => {
    const { error } = validate({
      evidenceIndex: -1,
      locationName: 'North pier'
    })
    expect(error.message).toContain('EVIDENCE_INDEX_INVALID')
  })

  test('should fail when evidence index is not an integer', () => {
    const { error } = validate({
      evidenceIndex: 1.5,
      locationName: 'North pier'
    })
    expect(error.message).toContain('EVIDENCE_INDEX_INVALID')
  })

  test('should fail when id is missing', () => {
    const { error } = updateSiteNoticeEvidenceSchema.validate({
      evidenceIndex: 0,
      locationName: 'North pier'
    })
    expect(error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
  })
})
