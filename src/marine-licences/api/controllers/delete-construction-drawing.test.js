import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { deleteConstructionDrawingController } from './delete-construction-drawing.js'
import Boom from '@hapi/boom'
import { blobService } from '../../../shared/services/data-service/blob-service.js'

vi.mock('../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    deleteFiles: vi.fn()
  }
}))

describe('PATCH /marine-licence/delete-construction-drawing', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const existingUpdatedAt = new Date('2024-12-01T10:00:00Z')
  const emptyDrawing = {}
  const mockId = new ObjectId().toHexString()

  const buildPayload = (overrides = {}) => ({
    id: mockId,
    siteIndex: 0,
    drawingIndex: 0,
    ...mockAuditPayload,
    ...overrides
  })

  const buildMarineLicence = (drawings = [emptyDrawing]) => ({
    updatedAt: existingUpdatedAt,
    siteDetails: [{ coordinatesType: 'manual', constructionDrawings: drawings }]
  })

  describe('handler', () => {
    it('should delete the drawing at the given index from the correct site', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload()

      const mockFindOne = vi.fn().mockResolvedValueOnce(buildMarineLicence())
      const mockUpdateOne = vi.fn().mockResolvedValue({ matchedCount: 1 })
      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        findOne: mockFindOne,
        updateOne: mockUpdateOne
      }))

      await deleteConstructionDrawingController.handler(
        { db: mockMongo, payload: mockPayload },
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith({ message: 'success' })
      expect(mockFindOne).toHaveBeenCalledWith({
        _id: ObjectId.createFromHexString(mockPayload.id),
        'siteDetails.0.constructionDrawings.0': { $exists: true }
      })
      expect(mockUpdateOne).toHaveBeenNthCalledWith(
        1,
        {
          _id: ObjectId.createFromHexString(mockPayload.id),
          'siteDetails.0': { $exists: true },
          updatedAt: existingUpdatedAt
        },
        {
          $unset: { 'siteDetails.0.constructionDrawings.0': 1 },
          $set: { siteDetailsConfirmed: false, ...mockAuditPayload }
        }
      )
      expect(mockUpdateOne).toHaveBeenNthCalledWith(
        2,
        { _id: ObjectId.createFromHexString(mockPayload.id) },
        { $pull: { 'siteDetails.0.constructionDrawings': null } }
      )
    })

    it('should throw 404 when marine licence not found or indexes are invalid', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload({ siteIndex: 99 })

      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        findOne: vi.fn().mockResolvedValueOnce(null)
      }))

      vi.spyOn(Boom, 'notFound')

      await expect(() =>
        deleteConstructionDrawingController.handler(
          { db: mockMongo, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow(
        `Construction Drawing not found for site 99 and drawing 0 for Marine Licence ${mockId}`
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
        deleteConstructionDrawingController.handler(
          { db: mockMongo, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow('was modified by another user')
    })

    describe('S3 cleanup', () => {
      const s3Location = {
        s3Bucket: 'mmo-uploads',
        s3Key: 'drawing-key',
        checksumSha256: 'abc123'
      }

      const setupMocks = (drawings, referencingLicences = []) => {
        const { mockMongo } = global
        const mockUpdateOne = vi.fn().mockResolvedValue({ matchedCount: 1 })
        vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
          findOne: vi.fn().mockResolvedValueOnce(buildMarineLicence(drawings)),
          updateOne: mockUpdateOne,
          find: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue(referencingLicences)
          })
        }))
      }

      it('should delete the deleted drawing file from S3', async () => {
        const { mockMongo, mockHandler } = global
        setupMocks([{ filename: 'drawing-1.pdf', s3Location }])

        await deleteConstructionDrawingController.handler(
          { db: mockMongo, payload: buildPayload() },
          mockHandler
        )

        expect(blobService.deleteFiles).toHaveBeenCalledWith([
          { s3Bucket: 'mmo-uploads', s3Key: 'drawing-key' }
        ])
      })

      it('should not delete from S3 when the drawing has no uploaded file', async () => {
        const { mockMongo, mockHandler } = global
        setupMocks([emptyDrawing])

        await deleteConstructionDrawingController.handler(
          { db: mockMongo, payload: buildPayload() },
          mockHandler
        )

        expect(blobService.deleteFiles).not.toHaveBeenCalled()
      })

      it('should not delete from S3 when another marine licence still references the file', async () => {
        const { mockMongo, mockHandler } = global
        setupMocks(
          [{ filename: 'drawing-1.pdf', s3Location }],
          [{ siteDetails: [{ constructionDrawings: [{ s3Location }] }] }]
        )

        await deleteConstructionDrawingController.handler(
          { db: mockMongo, payload: buildPayload() },
          mockHandler
        )

        expect(blobService.deleteFiles).not.toHaveBeenCalled()
      })

      it('should still succeed when the S3 delete fails', async () => {
        const { mockMongo, mockHandler } = global
        setupMocks([{ filename: 'drawing-1.pdf', s3Location }])
        blobService.deleteFiles.mockRejectedValue(new Error('S3 unavailable'))

        await deleteConstructionDrawingController.handler(
          { db: mockMongo, payload: buildPayload() },
          mockHandler
        )

        expect(mockHandler.response).toHaveBeenCalledWith({
          message: 'success'
        })
      })
    })

    it('should throw a 500 when the database operation fails', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload()
      const mockError = 'Database exploded'

      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        findOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }))

      await expect(() =>
        deleteConstructionDrawingController.handler(
          { db: mockMongo, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow(`Error deleting construction drawing: ${mockError}`)
    })
  })
})
