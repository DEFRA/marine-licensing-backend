import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { setupTestServer } from '../../../../tests/test-server.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { mockMarineLicence } from '../../models/test-fixtures.js'
import { buildWfdDocumentDownloadPathById } from '../../constants/water-framework-directive.js'
import { blobService } from '../../../shared/services/data-service/blob-service.js'

vi.mock('../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    getPresignedUrl: vi.fn()
  }
}))

describe('WFD document download URL - public integration tests', async () => {
  const getServer = await setupTestServer()
  const marineLicenceId = new ObjectId()
  const mockPresignedUrl =
    'https://s3.example.com/bucket/key?X-Amz-Signature=abc'

  const insertSubmittedMarineLicence = async (overrides = {}) => {
    await globalThis.mockMongo.collection('marine-licences').insertOne({
      ...mockMarineLicence,
      _id: marineLicenceId,
      status: MARINE_LICENCE_STATUS.SUBMITTED,
      waterFrameworkDirective: {
        nauticalMile: 'yes',
        excludedActivities: 'no',
        uploadedFile: { filename: 'assessment.docx' },
        s3Location: {
          s3Bucket: 'mmo-uploads',
          s3Key: 'exemptions/file-id',
          checksumSha256: 'abc123'
        }
      },
      ...overrides
    })
  }

  beforeEach(() => {
    blobService.getPresignedUrl.mockResolvedValue(mockPresignedUrl)
  })

  test('returns 200 with a presigned URL without authentication', async () => {
    await insertSubmittedMarineLicence()

    const response = await getServer().inject({
      method: 'GET',
      url: buildWfdDocumentDownloadPathById(marineLicenceId.toHexString())
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

  test('returns 404 when the marine licence id is not found', async () => {
    const response = await getServer().inject({
      method: 'GET',
      url: buildWfdDocumentDownloadPathById(new ObjectId().toHexString())
    })

    expect(response.statusCode).toBe(404)
  })

  test('returns 400 when the marine licence id format is invalid', async () => {
    const response = await getServer().inject({
      method: 'GET',
      url: '/public/marine-licence/not-a-valid-id/water-framework-directive/download-url'
    })

    expect(response.statusCode).toBe(400)
  })

  test('returns 403 when the marine licence is a draft', async () => {
    await insertSubmittedMarineLicence({
      status: MARINE_LICENCE_STATUS.DRAFT
    })

    const response = await getServer().inject({
      method: 'GET',
      url: buildWfdDocumentDownloadPathById(marineLicenceId.toHexString())
    })

    expect(response.statusCode).toBe(403)
  })

  test('returns 404 when no WFD document is stored', async () => {
    await insertSubmittedMarineLicence({
      waterFrameworkDirective: { nauticalMile: 'no' }
    })

    const response = await getServer().inject({
      method: 'GET',
      url: buildWfdDocumentDownloadPathById(marineLicenceId.toHexString())
    })

    expect(response.statusCode).toBe(404)
  })
})
