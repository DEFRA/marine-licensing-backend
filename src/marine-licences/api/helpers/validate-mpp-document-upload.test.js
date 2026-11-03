import { mockMarinePlanPolicyDocument } from '../../../../tests/test.fixture.js'
import { validateMppDocumentUpload } from './validate-mpp-document-upload.js'
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

describe('validateMppDocumentUpload', () => {
  beforeEach(() => {
    config.get.mockReturnValue('mmo-uploads')
    blobService.validateFileSize.mockResolvedValue({
      contentType: 'application/pdf'
    })
  })

  test('should throw forbidden error when s3Bucket does not match config', async () => {
    const invalidDocument = {
      ...mockMarinePlanPolicyDocument,
      s3Location: {
        ...mockMarinePlanPolicyDocument.s3Location,
        s3Bucket: 'wrong-bucket'
      }
    }

    await expect(validateMppDocumentUpload(invalidDocument)).rejects.toThrow(
      Boom.forbidden('Invalid S3 bucket')
    )
  })

  test('should validate against configured bucket name', async () => {
    config.get.mockReturnValue('different-bucket')

    const validDocument = {
      ...mockMarinePlanPolicyDocument,
      s3Location: {
        ...mockMarinePlanPolicyDocument.s3Location,
        s3Bucket: 'different-bucket'
      }
    }

    await expect(
      validateMppDocumentUpload(validDocument)
    ).resolves.toBeUndefined()
  })

  test('should throw entity too large when the file exceeds the document limit', async () => {
    blobService.validateFileSize.mockRejectedValueOnce(
      Boom.entityTooLarge('File too large')
    )

    await expect(
      validateMppDocumentUpload(mockMarinePlanPolicyDocument)
    ).rejects.toThrow(Boom.entityTooLarge('File too large'))
  })

  test('should throw unsupported media type for a disallowed content type', async () => {
    blobService.validateFileSize.mockResolvedValue({
      contentType: 'text/plain'
    })

    await expect(
      validateMppDocumentUpload(mockMarinePlanPolicyDocument)
    ).rejects.toThrow(
      Boom.unsupportedMediaType(
        'File must be a PDF or document (.doc, .docx, .odt)'
      )
    )
  })

  test.each([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text'
  ])('should pass validation for a %s file', async (contentType) => {
    blobService.validateFileSize.mockResolvedValue({ contentType })

    await expect(
      validateMppDocumentUpload(mockMarinePlanPolicyDocument)
    ).resolves.toBeUndefined()
  })
})
