import { MAS_TASK_TYPE } from '../constants/marine-licence.js'
import {
  resubmitSiteNoticeEvidenceMessageSchema,
  updateSiteNoticeResubmissionSchema
} from './resubmit-site-notice-evidence.js'

const photo = {
  uploadedFile: { filename: 'notice.jpg' },
  s3Location: {
    s3Bucket: 'mmo-uploads',
    s3Key: 'notice-key',
    checksumSha256: 'abc123'
  }
}

describe('resubmitSiteNoticeEvidenceMessageSchema', () => {
  const validate = (overrides = {}) =>
    resubmitSiteNoticeEvidenceMessageSchema.validate({
      applicationReference: 'MLA/2026/00001',
      taskType: MAS_TASK_TYPE.PUBLIC_NOTICE_EVIDENCE,
      userName: 'Jo Bloggs',
      userEmail: 'jo@example.com',
      rejectedLocations: [{ locationNumber: 1, reason: 'Blurred' }],
      ...overrides
    })

  test('passes with unknown fields on the message and its locations', () => {
    const { error } = validate({
      extra: 'x',
      rejectedLocations: [{ locationNumber: 1, reason: 'Blurred', note: 'x' }]
    })
    expect(error).toBeUndefined()
  })

  test('passes with no recipient', () => {
    const { error } = validate({ userName: null, userEmail: '' })
    expect(error).toBeUndefined()
  })

  test.each([
    ['no application reference', { applicationReference: ' ' }],
    ['another task type', { taskType: MAS_TASK_TYPE.PUBLIC_NOTICE }],
    ['no rejected locations', { rejectedLocations: [] }],
    [
      'a location with no reason',
      { rejectedLocations: [{ locationNumber: 1 }] }
    ],
    [
      'a location number below 1',
      { rejectedLocations: [{ locationNumber: 0, reason: 'a' }] }
    ],
    [
      'a repeated location',
      {
        rejectedLocations: [
          { locationNumber: 1, reason: 'a' },
          { locationNumber: 1, reason: 'b' }
        ]
      }
    ]
  ])('fails with %s', (_case, overrides) => {
    expect(validate(overrides).error).toBeDefined()
  })
})

describe('updateSiteNoticeResubmissionSchema', () => {
  const validate = (overrides = {}) =>
    updateSiteNoticeResubmissionSchema.validate({
      id: 'a'.repeat(24),
      taskId: 'b'.repeat(24),
      locationNumber: 1,
      closeUpPhoto: photo,
      ...overrides
    })

  test.each([
    ['one photo', {}],
    ['both photos', { positionPhoto: photo }]
  ])('passes with %s', (_case, overrides) => {
    expect(validate(overrides).error).toBeUndefined()
  })

  test.each([
    ['no photo', { closeUpPhoto: undefined }, 'SITE_NOTICE_PHOTO_REQUIRED'],
    ['no task id', { taskId: undefined }, 'APPLICATION_TASK_ID_REQUIRED'],
    ['a short task id', { taskId: '123' }, 'APPLICATION_TASK_ID_REQUIRED'],
    [
      'a non-hex task id',
      { taskId: 'z'.repeat(24) },
      'APPLICATION_TASK_ID_INVALID'
    ],
    [
      'no location number',
      { locationNumber: undefined },
      'LOCATION_NUMBER_REQUIRED'
    ],
    [
      'a location number of 0',
      { locationNumber: 0 },
      'LOCATION_NUMBER_INVALID'
    ],
    [
      'a fractional location number',
      { locationNumber: 1.5 },
      'LOCATION_NUMBER_INVALID'
    ],
    ['no id', { id: undefined }, 'MARINE_LICENCE_ID_REQUIRED']
  ])('fails with %s', (_case, overrides, message) => {
    expect(validate(overrides).error.message).toContain(message)
  })
})
