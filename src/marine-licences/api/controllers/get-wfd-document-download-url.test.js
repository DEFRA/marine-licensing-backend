import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { getWfdDocumentDownloadUrlController } from './get-wfd-document-download-url.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { notAuthorisedMessage } from '../../../shared/constants/errors.js'
import { blobService } from '../../../shared/services/data-service/blob-service.js'
import { WFD_PRESIGNED_URL_EXPIRES_IN_SECONDS } from '../../constants/water-framework-directive.js'

vi.mock('../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    getPresignedUrl: vi.fn()
  }
}))

describe('GET /public/marine-licence/{id}/water-framework-directive/download-url', () => {
  const mockId = new ObjectId().toHexString()
  const mockPresignedUrl =
    'https://s3.example.com/bucket/key?X-Amz-Signature=abc'

  const mockDoc = {
    status: MARINE_LICENCE_STATUS.SUBMITTED,
    waterFrameworkDirective: {
      nauticalMile: 'yes',
      excludedActivities: 'no',
      uploadedFile: { filename: 'assessment.docx' },
      s3Location: {
        s3Bucket: 'mmo-uploads',
        s3Key: 'exemptions/file-id'
      }
    }
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
      params: { id: mockId },
      db: { collection: mockCollection }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    blobService.getPresignedUrl.mockResolvedValue(mockPresignedUrl)
  })

  it('should throw a 404 when the document is not found', async () => {
    mockFindOne.mockResolvedValue(null)

    await expect(
      getWfdDocumentDownloadUrlController.handler(mockRequest, mockH)
    ).rejects.toThrow('Marine licence not found')
  })

  it('should return 403 when the marine licence is a draft', async () => {
    mockFindOne.mockResolvedValue({
      ...mockDoc,
      status: MARINE_LICENCE_STATUS.DRAFT
    })

    await expect(
      getWfdDocumentDownloadUrlController.handler(mockRequest, mockH)
    ).rejects.toThrow(notAuthorisedMessage)
  })

  it('should throw a 404 when no WFD document is stored', async () => {
    mockFindOne.mockResolvedValue({
      ...mockDoc,
      waterFrameworkDirective: { nauticalMile: 'no' }
    })

    await expect(
      getWfdDocumentDownloadUrlController.handler(mockRequest, mockH)
    ).rejects.toThrow('Water Framework Directive document not found')
  })

  it('should look up the marine licence by id', async () => {
    await getWfdDocumentDownloadUrlController.handler(mockRequest, mockH)

    expect(mockFindOne).toHaveBeenCalledWith(
      { _id: ObjectId.createFromHexString(mockId) },
      { projection: { waterFrameworkDirective: 1, status: 1 } }
    )
  })

  it('should generate a presigned URL from the stored S3 location', async () => {
    await getWfdDocumentDownloadUrlController.handler(mockRequest, mockH)

    expect(blobService.getPresignedUrl).toHaveBeenCalledWith(
      'mmo-uploads',
      'exemptions/file-id',
      WFD_PRESIGNED_URL_EXPIRES_IN_SECONDS
    )
  })

  it('should return the presigned URL and expiry', async () => {
    await getWfdDocumentDownloadUrlController.handler(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith({
      message: 'success',
      value: {
        url: mockPresignedUrl,
        expiresIn: WFD_PRESIGNED_URL_EXPIRES_IN_SECONDS
      }
    })
    expect(mockH.code).toHaveBeenCalledWith(200)
  })
})
