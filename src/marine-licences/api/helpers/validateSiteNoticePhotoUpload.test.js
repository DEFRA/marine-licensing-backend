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

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}))

vi.mock('../../../shared/common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn().mockReturnValue(mockLogger)
}))

describe('validateSiteNoticePhotoUpload', () => {
  const s3Location = {
    s3Bucket: 'mmo-uploads',
    s3Key: 'test-file-key',
    checksumSha256: 'test-checksum'
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
      validateSiteNoticePhotoUpload({
        ...s3Location,
        s3Bucket: 'wrong-bucket'
      })
    ).rejects.toThrow(Boom.forbidden('Invalid S3 bucket'))
  })

  test('should throw entity too large error when file exceeds 10MB', async () => {
    blobService.getMetadata.mockResolvedValue({
      size: 10 * 1024 * 1024 + 1,
      contentType: 'image/jpeg'
    })

    await expect(validateSiteNoticePhotoUpload(s3Location)).rejects.toThrow(
      /exceeds maximum allowed size/
    )
  })

  test('should throw unsupported media type error when file is not jpg or png', async () => {
    blobService.getMetadata.mockResolvedValue({
      size: 1_000_000,
      contentType: 'image/gif'
    })

    await expect(validateSiteNoticePhotoUpload(s3Location)).rejects.toThrow(
      Boom.unsupportedMediaType('File must be a JPG or PNG image')
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
        validateSiteNoticePhotoUpload(s3Location)
      ).resolves.toBeUndefined()
    }
  )
})
