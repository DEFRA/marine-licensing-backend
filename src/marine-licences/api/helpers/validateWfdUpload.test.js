import { mockWaterFrameworkDirective } from '../../../../tests/test.fixture.js'
import { validateWfdUpload } from './validateWfdUpload.js'
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
    validateFileSize: vi.fn()
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

describe('validateWfdUpload', () => {
  beforeEach(() => {
    config.get.mockReturnValue('mmo-uploads')
    blobService.validateFileSize.mockResolvedValue({
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    })
  })

  test('should throw forbidden error when s3Bucket does not match config', async () => {
    const invalidWfd = {
      ...mockWaterFrameworkDirective,
      s3Location: { s3Bucket: 'wrong-bucket' }
    }

    await expect(validateWfdUpload(invalidWfd)).rejects.toThrow(
      Boom.forbidden('Invalid S3 bucket')
    )
  })

  test('should validate against configured bucket name', async () => {
    config.get.mockReturnValue('different-bucket')

    const mockWaterFrameworkDirectiveValid = {
      ...mockWaterFrameworkDirective,
      s3Location: {
        ...mockWaterFrameworkDirective.s3Location,
        s3Bucket: 'different-bucket'
      }
    }

    await expect(
      validateWfdUpload(mockWaterFrameworkDirectiveValid)
    ).resolves.toBeUndefined()
  })

  test('should throw unsupported media type error when file is not odt or docx', async () => {
    blobService.validateFileSize.mockResolvedValue({
      contentType: 'application/zip'
    })

    await expect(
      validateWfdUpload(mockWaterFrameworkDirective)
    ).rejects.toThrow(
      Boom.unsupportedMediaType('File must be an ODT or DOCX document')
    )
  })

  test('should pass validation for an odt file', async () => {
    blobService.validateFileSize.mockResolvedValue({
      contentType: 'application/vnd.oasis.opendocument.text'
    })

    await validateWfdUpload(mockWaterFrameworkDirective)
  })
})
