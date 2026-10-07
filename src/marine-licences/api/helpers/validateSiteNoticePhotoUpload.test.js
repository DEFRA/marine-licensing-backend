import { validateSiteNoticePhotoUpload } from './validateSiteNoticePhotoUpload.js'
import Boom from '@hapi/boom'
import { config } from '../../../config.js'
import { blobService } from '../../../shared/services/data-service/blob-service.js'

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn()
  }
}))

vi.mock('../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    getMetadata: vi.fn()
  }
}))

describe('validateSiteNoticePhotoUpload', () => {
  const s3Location = {
    s3Bucket: 'mmo-uploads',
    s3Key: 'test-file-key',
    checksumSha256: 'test-checksum'
  }

  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }

  beforeEach(() => {
    config.get.mockReturnValue('mmo-uploads')
    blobService.getMetadata.mockResolvedValue({
      size: 1_000_000,
      contentType: 'image/jpeg'
    })
  })

  test('should throw forbidden error when s3Bucket does not match config', async () => {
    await expect(
      validateSiteNoticePhotoUpload(
        { ...s3Location, s3Bucket: 'wrong-bucket' },
        mockLogger
      )
    ).rejects.toThrow(Boom.forbidden('Invalid S3 bucket'))

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: 'SiteNoticePhoto:Upload Validation:bucket-validation',
          outcome: 'failure'
        })
      }),
      'S3 bucket validation failed'
    )
  })

  test('should throw entity too large error when file exceeds 10MB', async () => {
    blobService.getMetadata.mockResolvedValue({
      size: 10 * 1024 * 1024 + 1,
      contentType: 'image/jpeg'
    })

    await expect(
      validateSiteNoticePhotoUpload(s3Location, mockLogger)
    ).rejects.toThrow(/exceeds maximum allowed size/)

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: 'SiteNoticePhoto:Upload Validation:size-validation',
          outcome: 'failure'
        })
      }),
      'File size validation failed'
    )
  })

  test('should throw unsupported media type error when file is not jpg or png', async () => {
    blobService.getMetadata.mockResolvedValue({
      size: 1_000_000,
      contentType: 'image/gif'
    })

    await expect(
      validateSiteNoticePhotoUpload(s3Location, mockLogger)
    ).rejects.toThrow(
      Boom.unsupportedMediaType('File must be a JPG or PNG image')
    )

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: 'SiteNoticePhoto:Upload Validation:type-validation',
          outcome: 'failure'
        }),
        contentType: 'image/gif'
      }),
      'File type validation failed'
    )
  })

  test.each(['image/jpeg', 'image/png'])(
    'should pass validation for %s',
    async (contentType) => {
      blobService.getMetadata.mockResolvedValue({
        size: 10 * 1024 * 1024,
        contentType
      })

      await expect(
        validateSiteNoticePhotoUpload(s3Location, mockLogger)
      ).resolves.toBeUndefined()
    }
  )
})
