import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { setupTestServer } from '../../../../tests/test-server.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { mockMarineLicence } from '../../models/test-fixtures.js'
import {
  SITE_NOTICE_PHOTO_TYPE,
  buildSiteNoticePhotoDownloadPath
} from '../../constants/site-notice-evidence.js'
import { blobService } from '../../../shared/services/data-service/blob-service.js'
import { logResponseSchemaMismatch } from '../../../shared/common/helpers/log-response-schema-mismatch.js'

vi.mock('../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    getPresignedUrl: vi.fn()
  }
}))

vi.mock(
  '../../../shared/common/helpers/log-response-schema-mismatch.js',
  async (importOriginal) => {
    const actual = await importOriginal()
    return {
      logResponseSchemaMismatch: vi.fn(actual.logResponseSchemaMismatch)
    }
  }
)

describe('Site notice photo download URL - public integration tests', async () => {
  const getServer = await setupTestServer()
  const marineLicenceId = new ObjectId()
  const mockPresignedUrl =
    'https://s3.example.com/bucket/key?X-Amz-Signature=abc'

  const downloadPath = (locationNumber, photoType) =>
    buildSiteNoticePhotoDownloadPath(
      marineLicenceId.toHexString(),
      locationNumber,
      photoType
    )

  const insertSubmittedMarineLicence = async (overrides = {}) => {
    await globalThis.mockMongo.collection('marine-licences').insertOne({
      ...mockMarineLicence,
      _id: marineLicenceId,
      status: MARINE_LICENCE_STATUS.SUBMITTED,
      siteNoticeEvidence: [
        {
          locationName: 'North pier',
          closeUpPhoto: {
            uploadedFile: { filename: 'close-up.jpg' },
            s3Location: {
              s3Bucket: 'mmo-uploads',
              s3Key: 'site-notice/close-up',
              checksumSha256: 'abc123'
            }
          },
          positionPhoto: {
            uploadedFile: { filename: 'position.jpg' },
            s3Location: {
              s3Bucket: 'mmo-uploads',
              s3Key: 'site-notice/position',
              checksumSha256: 'def456'
            }
          }
        }
      ],
      ...overrides
    })
  }

  beforeEach(() => {
    blobService.getPresignedUrl.mockResolvedValue(mockPresignedUrl)
  })

  afterEach(() => {
    expect(logResponseSchemaMismatch).not.toHaveBeenCalled()
  })

  test('returns 200 with a close-up photo presigned URL without authentication', async () => {
    await insertSubmittedMarineLicence()

    const response = await getServer().inject({
      method: 'GET',
      url: downloadPath(1, SITE_NOTICE_PHOTO_TYPE.CLOSE_UP)
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload)).toEqual({
      message: 'success',
      value: {
        url: mockPresignedUrl,
        expiresIn: 3600
      }
    })
  })

  test('returns 200 with a position photo presigned URL without authentication', async () => {
    await insertSubmittedMarineLicence()

    const response = await getServer().inject({
      method: 'GET',
      url: downloadPath(1, SITE_NOTICE_PHOTO_TYPE.POSITION)
    })

    expect(response.statusCode).toBe(200)
    expect(blobService.getPresignedUrl).toHaveBeenCalledWith(
      'mmo-uploads',
      'site-notice/position',
      3600
    )
  })

  test('returns 404 when the marine licence id is not found', async () => {
    const response = await getServer().inject({
      method: 'GET',
      url: buildSiteNoticePhotoDownloadPath(
        new ObjectId().toHexString(),
        1,
        SITE_NOTICE_PHOTO_TYPE.CLOSE_UP
      )
    })

    expect(response.statusCode).toBe(404)
  })

  test('returns 400 when the marine licence id format is invalid', async () => {
    const response = await getServer().inject({
      method: 'GET',
      url: '/public/marine-licence/not-a-valid-id/site-notice-evidence/1/close-up/download-url'
    })

    expect(response.statusCode).toBe(400)
  })

  test('returns 400 when locationNumber is less than 1', async () => {
    const response = await getServer().inject({
      method: 'GET',
      url: downloadPath(0, SITE_NOTICE_PHOTO_TYPE.CLOSE_UP)
    })

    expect(response.statusCode).toBe(400)
  })

  test('returns 400 when photoType is invalid', async () => {
    const response = await getServer().inject({
      method: 'GET',
      url: downloadPath(1, 'side-view')
    })

    expect(response.statusCode).toBe(400)
  })

  test('returns 403 when the marine licence is a draft', async () => {
    await insertSubmittedMarineLicence({
      status: MARINE_LICENCE_STATUS.DRAFT
    })

    const response = await getServer().inject({
      method: 'GET',
      url: downloadPath(1, SITE_NOTICE_PHOTO_TYPE.CLOSE_UP)
    })

    expect(response.statusCode).toBe(403)
  })

  test('returns 404 when the location does not exist', async () => {
    await insertSubmittedMarineLicence()

    const response = await getServer().inject({
      method: 'GET',
      url: downloadPath(2, SITE_NOTICE_PHOTO_TYPE.CLOSE_UP)
    })

    expect(response.statusCode).toBe(404)
  })

  test('returns 404 when no photograph is stored for that type', async () => {
    await insertSubmittedMarineLicence({
      siteNoticeEvidence: [{ locationName: 'North pier' }]
    })

    const response = await getServer().inject({
      method: 'GET',
      url: downloadPath(1, SITE_NOTICE_PHOTO_TYPE.CLOSE_UP)
    })

    expect(response.statusCode).toBe(404)
  })
})
