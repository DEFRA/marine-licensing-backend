import { validateConstructionDrawingUpload } from './validateConstructionDrawingUpload.js'
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

describe('validateConstructionDrawingUpload', () => {
  const s3Location = {
    s3Bucket: 'mmo-uploads',
    s3Key: 'test-file-key',
    checksumSha256: 'test-checksum'
  }

  beforeEach(() => {
    config.get.mockReturnValue('mmo-uploads')
    blobService.getMetadata.mockResolvedValue({
      size: 1_000_000,
      contentType: 'application/pdf'
    })
  })

  test('should throw forbidden error when s3Bucket does not match config', async () => {
    await expect(
      validateConstructionDrawingUpload({
        ...s3Location,
        s3Bucket: 'wrong-bucket'
      })
    ).rejects.toThrow(Boom.forbidden('Invalid S3 bucket'))
  })

  test('should validate against configured bucket name', async () => {
    config.get.mockReturnValue('different-bucket')

    await expect(
      validateConstructionDrawingUpload({
        ...s3Location,
        s3Bucket: 'different-bucket'
      })
    ).resolves.toBeUndefined()
  })

  test('should throw entity too large error when file exceeds 10MB', async () => {
    blobService.getMetadata.mockResolvedValue({
      size: 10 * 1024 * 1024 + 1,
      contentType: 'application/pdf'
    })

    await expect(validateConstructionDrawingUpload(s3Location)).rejects.toThrow(
      /exceeds maximum allowed size/
    )
  })

  test('should throw unsupported media type error when file is not pdf or an allowed image', async () => {
    blobService.getMetadata.mockResolvedValue({
      size: 1_000_000,
      contentType: 'application/zip'
    })

    await expect(validateConstructionDrawingUpload(s3Location)).rejects.toThrow(
      Boom.unsupportedMediaType(
        'File must be a PDF or an image (BMP, GIF, JPG, PNG, TIF)'
      )
    )
  })

  test('should pass validation for a pdf file', async () => {
    await validateConstructionDrawingUpload(s3Location)
  })

  test('should pass validation for an allowed image type', async () => {
    blobService.getMetadata.mockResolvedValue({
      size: 1_000_000,
      contentType: 'image/png'
    })

    await validateConstructionDrawingUpload(s3Location)
  })
})
