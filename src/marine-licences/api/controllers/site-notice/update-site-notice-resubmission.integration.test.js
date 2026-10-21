import { vi } from 'vitest'
import Boom from '@hapi/boom'
import { ObjectId } from 'mongodb'
import { setupTestServer } from '../../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../../tests/server-requests.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { createCompleteMarineLicence } from '../../../../../tests/test.fixture.js'
import { APPLICATION_TASK_TYPE } from '../../../constants/marine-licence.js'
import { validateSiteNoticePhotoUpload } from '../../helpers/validateSiteNoticePhotoUpload.js'

vi.mock('../../helpers/validateSiteNoticePhotoUpload.js')

const url = '/marine-licence/update-site-notice-resubmission'

describe('PATCH /marine-licence/update-site-notice-resubmission - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'

  const originalEvidence = [
    { locationName: 'Harbour board', closeUpPhoto: { s3Key: 'old' } }
  ]

  const photo = {
    uploadedFile: { filename: 'new-close-up.jpg' },
    s3Location: {
      s3Bucket: 'mmo-uploads',
      s3Key: 'new-close-up',
      checksumSha256: 'abc123'
    }
  }

  const insertLicence = async (taskOverrides = {}) => {
    const licenceId = new ObjectId()
    const taskId = new ObjectId().toHexString()

    await globalThis.mockMongo.collection(collectionMarineLicences).insertOne({
      ...createCompleteMarineLicence(),
      _id: licenceId,
      contactId,
      siteNoticeEvidence: originalEvidence,
      applicationTasks: [
        {
          taskId,
          type: APPLICATION_TASK_TYPE.RESUBMIT_SITE_NOTICE_EVIDENCE,
          receivedAt: new Date(),
          resolvedAt: null,
          data: {
            locations: [
              { locationNumber: 1, reason: 'Blurred' },
              { locationNumber: 3, reason: 'Too dark' }
            ]
          },
          ...taskOverrides
        }
      ]
    })

    return { licenceId, taskId }
  }

  const stored = (licenceId) =>
    globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: licenceId })

  const patch = (payload, asContactId = contactId) =>
    makePatchRequest({
      server: getServer(),
      url,
      contactId: asContactId,
      payload
    })

  test('stores the photo against the location on the task, leaving the original evidence alone', async () => {
    const { licenceId, taskId } = await insertLicence()

    const { statusCode } = await patch({
      id: licenceId.toString(),
      taskId,
      locationNumber: 3,
      closeUpPhoto: photo
    })

    expect(statusCode).toBe(200)
    expect(validateSiteNoticePhotoUpload).toHaveBeenCalledWith(
      photo.s3Location,
      expect.any(Object)
    )

    const licence = await stored(licenceId)
    expect(licence.applicationTasks[0].data.locations).toEqual([
      { locationNumber: 1, reason: 'Blurred' },
      { locationNumber: 3, reason: 'Too dark', closeUpPhoto: photo }
    ])
    expect(licence.siteNoticeEvidence).toEqual(originalEvidence)
  })

  test('stores both photos when sent together', async () => {
    const { licenceId, taskId } = await insertLicence()

    const { statusCode } = await patch({
      id: licenceId.toString(),
      taskId,
      locationNumber: 1,
      closeUpPhoto: photo,
      positionPhoto: photo
    })

    expect(statusCode).toBe(200)
    expect(validateSiteNoticePhotoUpload).toHaveBeenCalledTimes(2)
    const [task] = (await stored(licenceId)).applicationTasks
    expect(task.data.locations[0]).toEqual({
      locationNumber: 1,
      reason: 'Blurred',
      closeUpPhoto: photo,
      positionPhoto: photo
    })
  })

  test.each([
    ['a location the caseworker did not reject', {}, { locationNumber: 2 }],
    ['a resolved task', { resolvedAt: new Date() }, {}],
    [
      'a task of another type',
      { type: APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE },
      {}
    ],
    ['an unknown task', {}, { taskId: new ObjectId().toHexString() }]
  ])(
    'returns 404 without saving for %s',
    async (_case, taskOverrides, payloadOverrides) => {
      const { licenceId, taskId } = await insertLicence(taskOverrides)
      const before = await stored(licenceId)

      const { statusCode } = await patch({
        id: licenceId.toString(),
        taskId,
        locationNumber: 1,
        positionPhoto: photo,
        ...payloadOverrides
      })

      expect(statusCode).toBe(404)
      expect(await stored(licenceId)).toEqual(before)
    }
  )

  test('returns the upload check error without saving the photo', async () => {
    vi.mocked(validateSiteNoticePhotoUpload).mockRejectedValueOnce(
      Boom.unsupportedMediaType('File must be a JPG or PNG image')
    )
    const { licenceId, taskId } = await insertLicence()

    const { statusCode } = await patch({
      id: licenceId.toString(),
      taskId,
      locationNumber: 1,
      closeUpPhoto: photo
    })

    expect(statusCode).toBe(415)
    const [task] = (await stored(licenceId)).applicationTasks
    expect(task.data.locations[0]).not.toHaveProperty('closeUpPhoto')
  })

  test(`returns 403 when updating another user's marine licence`, async () => {
    const { licenceId, taskId } = await insertLicence()

    const { statusCode } = await patch(
      {
        id: licenceId.toString(),
        taskId,
        locationNumber: 1,
        closeUpPhoto: photo
      },
      differentContactId
    )

    expect(statusCode).toBe(403)
  })

  test('returns 400 when the payload is invalid', async () => {
    const { licenceId, taskId } = await insertLicence()

    const { statusCode, body } = await patch({
      id: licenceId.toString(),
      taskId,
      locationNumber: 1
    })

    expect(statusCode).toBe(400)
    expect(body.message).toContain('SITE_NOTICE_PHOTO_REQUIRED')
  })
})
