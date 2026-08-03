import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { deleteConstructionDrawingsController } from './delete-construction-drawings.js'
import Boom from '@hapi/boom'

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
