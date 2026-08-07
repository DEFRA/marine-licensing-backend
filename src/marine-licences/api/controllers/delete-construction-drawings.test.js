import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { deleteConstructionDrawingsController } from './delete-construction-drawings.js'
import Boom from '@hapi/boom'
import { blobService } from '../../../shared/services/data-service/blob-service.js'

vi.mock('../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    deleteFiles: vi.fn()
  }
}))

describe('PATCH /marine-licence/delete-construction-drawings', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const existingUpdatedAt = new Date('2024-12-01T10:00:00Z')
  const mockId = new ObjectId().toHexString()

  const buildPayload = (overrides = {}) => ({
    id: mockId,
    siteIndex: 0,
    ...mockAuditPayload,
    ...overrides
  })

  const buildMarineLicence = (drawings = [{ filename: 'drawing.pdf' }]) => ({
    updatedAt: existingUpdatedAt,
    siteDetails: [{ coordinatesType: 'manual', constructionDrawings: drawings }]
  })

  describe('handler', () => {
    it('should delete all drawings from the correct site', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload()

      const mockFindOne = vi.fn().mockResolvedValueOnce(buildMarineLicence())
      const mockUpdateOne = vi.fn().mockResolvedValue({ matchedCount: 1 })
      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        findOne: mockFindOne,
        updateOne: mockUpdateOne
      }))

      await deleteConstructionDrawingsController.handler(
        { db: mockMongo, payload: mockPayload },
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith({ message: 'success' })
      expect(mockFindOne).toHaveBeenCalledWith({
        _id: ObjectId.createFromHexString(mockPayload.id),
        'siteDetails.0': { $exists: true }
      })
      expect(mockUpdateOne).toHaveBeenCalledWith(
        {
          _id: ObjectId.createFromHexString(mockPayload.id),
          'siteDetails.0': { $exists: true },
          updatedAt: existingUpdatedAt
        },
        {
          $unset: { 'siteDetails.0.constructionDrawings': 1 },
          $set: { siteDetailsConfirmed: false, ...mockAuditPayload }
        }
      )
    })

    describe('S3 cleanup', () => {
      const s3Location = (s3Key) => ({
        s3Bucket: 'mmo-uploads',
        s3Key,
        checksumSha256: 'abc123'
      })

      const setupMocks = (drawings, referencingLicences = []) => {
        const { mockMongo } = global
        vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
          findOne: vi.fn().mockResolvedValueOnce(buildMarineLicence(drawings)),
          updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
          find: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue(referencingLicences)
          })
        }))
      }

      it('should delete every drawing file for the site from S3', async () => {
        const { mockMongo, mockHandler } = global
        setupMocks([
          { filename: 'drawing-1.pdf', s3Location: s3Location('key-1') },
          {},
          { filename: 'drawing-3.pdf', s3Location: s3Location('key-3') }
        ])

        await deleteConstructionDrawingsController.handler(
          { db: mockMongo, payload: buildPayload() },
          mockHandler
        )

        expect(blobService.deleteFiles).toHaveBeenCalledWith([
          { s3Bucket: 'mmo-uploads', s3Key: 'key-1' },
          { s3Bucket: 'mmo-uploads', s3Key: 'key-3' }
        ])
      })

      it('should not delete files still referenced by another marine licence', async () => {
        const { mockMongo, mockHandler } = global
        setupMocks(
          [
            { filename: 'drawing-1.pdf', s3Location: s3Location('shared') },
            { filename: 'drawing-2.pdf', s3Location: s3Location('unique') }
          ],
          [
            {
              siteDetails: [
                { constructionDrawings: [{ s3Location: s3Location('shared') }] }
              ]
            }
          ]
        )

        await deleteConstructionDrawingsController.handler(
          { db: mockMongo, payload: buildPayload() },
          mockHandler
        )

        expect(blobService.deleteFiles).toHaveBeenCalledWith([
          { s3Bucket: 'mmo-uploads', s3Key: 'unique' }
        ])
      })

      it('should still succeed when the S3 delete fails', async () => {
        const { mockMongo, mockHandler } = global
        setupMocks([
          { filename: 'drawing-1.pdf', s3Location: s3Location('key-1') }
        ])
        blobService.deleteFiles.mockRejectedValue(new Error('S3 unavailable'))

        await deleteConstructionDrawingsController.handler(
          { db: mockMongo, payload: buildPayload() },
          mockHandler
        )

        expect(mockHandler.response).toHaveBeenCalledWith({
          message: 'success'
        })
      })
    })

    it('should throw 404 when marine licence or site not found', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload({ siteIndex: 99 })

      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        findOne: vi.fn().mockResolvedValueOnce(null)
      }))

      vi.spyOn(Boom, 'notFound')

      await expect(() =>
        deleteConstructionDrawingsController.handler(
          { db: mockMongo, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow(
        `Site not found at index 99 for Marine Licence ${mockId}`
      )
    })

    it('should throw 409 when the document was modified by another user', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload()

      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        findOne: vi.fn().mockResolvedValueOnce(buildMarineLicence()),
        updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }))

      vi.spyOn(Boom, 'conflict')

      await expect(() =>
        deleteConstructionDrawingsController.handler(
          { db: mockMongo, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow('was modified by another user')
    })

    it('should throw a 500 when the database operation fails', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload()
      const mockError = 'Database exploded'

      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        findOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }))

      await expect(() =>
        deleteConstructionDrawingsController.handler(
          { db: mockMongo, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow(`Error deleting construction drawings: ${mockError}`)
    })
  })
})
