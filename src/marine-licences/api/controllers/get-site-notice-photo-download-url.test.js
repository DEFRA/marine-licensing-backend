import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { getSiteNoticePhotoDownloadUrlController } from './get-site-notice-photo-download-url.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { SITE_NOTICE_PHOTO_PRESIGNED_URL_EXPIRES_IN_SECONDS } from '../../constants/site-notice-evidence.js'
import { notAuthorisedMessage } from '../../../shared/constants/errors.js'
import { blobService } from '../../../shared/services/data-service/blob-service.js'
import { logResponseSchemaMismatch } from '../../../shared/common/helpers/log-response-schema-mismatch.js'

vi.mock('../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    getPresignedUrl: vi.fn()
  }
}))

describe('GET /public/marine-licence/{id}/site-notice-evidence/{locationNumber}/{photoType}/download-url', () => {
  const mockId = new ObjectId().toHexString()
  const mockPresignedUrl =
    'https://s3.example.com/bucket/key?X-Amz-Signature=abc'

  const mockDoc = {
    status: MARINE_LICENCE_STATUS.SUBMITTED,
    siteNoticeEvidence: [
      {
        locationName: 'North pier',
        closeUpPhoto: {
          uploadedFile: { filename: 'close-up.jpg' },
          s3Location: {
            s3Bucket: 'mmo-uploads',
            s3Key: 'site-notice/close-up'
          }
        },
        positionPhoto: {
          uploadedFile: { filename: 'position.jpg' },
          s3Location: {
            s3Bucket: 'mmo-uploads',
            s3Key: 'site-notice/position'
          }
        }
      }
    ]
  }

  let mockFindOne
  let mockRequest
  let mockH

  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    mockFindOne = vi.fn().mockResolvedValue(mockDoc)
    const mockCollection = vi.fn().mockReturnValue({ findOne: mockFindOne })

    mockRequest = {
      params: { id: mockId, locationNumber: 1, photoType: 'close-up' },
      db: { collection: mockCollection }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    blobService.getPresignedUrl.mockResolvedValue(mockPresignedUrl)
  })

  it('should throw a 404 when the marine licence is not found', async () => {
    mockFindOne.mockResolvedValue(null)

    await expect(
      getSiteNoticePhotoDownloadUrlController.handler(mockRequest, mockH)
    ).rejects.toThrow('Marine licence not found')
  })

  it('should return 403 when the marine licence is a draft', async () => {
    mockFindOne.mockResolvedValue({
      ...mockDoc,
      status: MARINE_LICENCE_STATUS.DRAFT
    })

    await expect(
      getSiteNoticePhotoDownloadUrlController.handler(mockRequest, mockH)
    ).rejects.toThrow(notAuthorisedMessage)
  })

  it('should throw a 404 when the location does not exist', async () => {
    mockRequest.params.locationNumber = 2

    await expect(
      getSiteNoticePhotoDownloadUrlController.handler(mockRequest, mockH)
    ).rejects.toThrow('Site notice photograph not found')
  })

  it('should throw a 404 when the photo type is missing for the location', async () => {
    mockFindOne.mockResolvedValue({
      ...mockDoc,
      siteNoticeEvidence: [{ locationName: 'North pier' }]
    })

    await expect(
      getSiteNoticePhotoDownloadUrlController.handler(mockRequest, mockH)
    ).rejects.toThrow('Site notice photograph not found')
  })

  it('should look up the marine licence by id', async () => {
    await getSiteNoticePhotoDownloadUrlController.handler(mockRequest, mockH)

    expect(mockFindOne).toHaveBeenCalledWith(
      { _id: ObjectId.createFromHexString(mockId) },
      { projection: { siteNoticeEvidence: 1, status: 1 } }
    )
  })

  it('should generate a close-up photo presigned URL from the stored S3 location', async () => {
    await getSiteNoticePhotoDownloadUrlController.handler(mockRequest, mockH)

    expect(blobService.getPresignedUrl).toHaveBeenCalledWith(
      'mmo-uploads',
      'site-notice/close-up',
      SITE_NOTICE_PHOTO_PRESIGNED_URL_EXPIRES_IN_SECONDS
    )
  })

  it('should generate a position photo presigned URL from the stored S3 location', async () => {
    mockRequest.params.photoType = 'position'

    await getSiteNoticePhotoDownloadUrlController.handler(mockRequest, mockH)

    expect(blobService.getPresignedUrl).toHaveBeenCalledWith(
      'mmo-uploads',
      'site-notice/position',
      SITE_NOTICE_PHOTO_PRESIGNED_URL_EXPIRES_IN_SECONDS
    )
  })

  it('should return the presigned URL and expiry', async () => {
    await getSiteNoticePhotoDownloadUrlController.handler(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith({
      message: 'success',
      value: {
        url: mockPresignedUrl,
        expiresIn: SITE_NOTICE_PHOTO_PRESIGNED_URL_EXPIRES_IN_SECONDS
      }
    })
    expect(mockH.code).toHaveBeenCalledWith(200)
  })

  test('documents the route and logs response schema mismatches', () => {
    const { options } = getSiteNoticePhotoDownloadUrlController

    expect(options.tags).toEqual(['api'])
    expect(options.response.failAction).toBe(logResponseSchemaMismatch)
  })
})
