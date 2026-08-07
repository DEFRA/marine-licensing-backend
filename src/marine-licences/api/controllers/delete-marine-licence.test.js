import { vi } from 'vitest'
import { deleteMarineLicenceController } from './delete-marine-licence.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { blobService } from '../../../shared/services/data-service/blob-service.js'

vi.mock('../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    deleteFiles: vi.fn()
  }
}))

describe('DELETE /marine-licence', () => {
  const paramsValidator = deleteMarineLicenceController.options.validate.params

  const mockId = '123456789123456789123456'

  it('should fail if fields are missing', () => {
    const result = paramsValidator.validate({})

    expect(result.error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
  })

  it('should fail if fields are incorrect length', () => {
    const result = paramsValidator.validate({ id: '123' })

    expect(result.error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
  })

  it('should fail if id has incorrect characters', () => {
    const result = paramsValidator.validate({ id: mockId.replace('1', '+') })

    expect(result.error.message).toContain('MARINE_LICENCE_ID_INVALID')
  })

  it('should delete marine licence by id when status is DRAFT', async () => {
    const { mockMongo, mockHandler } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOne: vi.fn().mockResolvedValue({
          _id: mockId,
          status: MARINE_LICENCE_STATUS.DRAFT
        }),
        deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 })
      }
    })

    await deleteMarineLicenceController.handler(
      { db: mockMongo, params: { id: mockId } },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Marine licence deleted successfully'
      })
    )
  })

  describe('S3 cleanup', () => {
    const s3Location = (s3Key) => ({
      s3Bucket: 'mmo-uploads',
      s3Key,
      checksumSha256: 'abc123'
    })

    const draftLicenceWithUploads = {
      _id: mockId,
      status: MARINE_LICENCE_STATUS.DRAFT,
      siteDetails: [
        {
          constructionDrawings: [
            { filename: 'drawing-1.pdf', s3Location: s3Location('drawing-1') },
            {}
          ]
        },
        {
          constructionDrawings: [
            { filename: 'drawing-2.pdf', s3Location: s3Location('drawing-2') }
          ]
        }
      ],
      waterFrameworkDirective: {
        nauticalMile: 'yes',
        s3Location: s3Location('wfd-doc')
      }
    }

    const setupMocks = (marineLicence, referencingLicences = []) => {
      const { mockMongo } = global
      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        findOne: vi.fn().mockResolvedValue(marineLicence),
        deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
        find: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(referencingLicences)
        })
      }))
    }

    it('should delete every construction drawing and the WFD document from S3', async () => {
      const { mockMongo, mockHandler } = global
      setupMocks(draftLicenceWithUploads)

      await deleteMarineLicenceController.handler(
        { db: mockMongo, params: { id: mockId } },
        mockHandler
      )

      expect(blobService.deleteFiles).toHaveBeenCalledWith([
        { s3Bucket: 'mmo-uploads', s3Key: 'drawing-1' },
        { s3Bucket: 'mmo-uploads', s3Key: 'drawing-2' },
        { s3Bucket: 'mmo-uploads', s3Key: 'wfd-doc' }
      ])
    })

    it('should not delete files still referenced by another marine licence', async () => {
      const { mockMongo, mockHandler } = global
      setupMocks(draftLicenceWithUploads, [
        {
          siteDetails: [
            {
              constructionDrawings: [{ s3Location: s3Location('drawing-1') }]
            }
          ],
          waterFrameworkDirective: { s3Location: s3Location('wfd-doc') }
        }
      ])

      await deleteMarineLicenceController.handler(
        { db: mockMongo, params: { id: mockId } },
        mockHandler
      )

      expect(blobService.deleteFiles).toHaveBeenCalledWith([
        { s3Bucket: 'mmo-uploads', s3Key: 'drawing-2' }
      ])
    })

    it('should still succeed when the S3 delete fails', async () => {
      const { mockMongo, mockHandler } = global
      setupMocks(draftLicenceWithUploads)
      blobService.deleteFiles.mockRejectedValue(new Error('S3 unavailable'))

      await deleteMarineLicenceController.handler(
        { db: mockMongo, params: { id: mockId } },
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Marine licence deleted successfully'
        })
      )
    })
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global

    const mockError = 'Database failed'

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      deleteMarineLicenceController.handler(
        { db: mockMongo, params: { id: mockId } },
        mockHandler
      )
    ).rejects.toThrow(`Error deleting marine licence: ${mockError}`)
  })
})
