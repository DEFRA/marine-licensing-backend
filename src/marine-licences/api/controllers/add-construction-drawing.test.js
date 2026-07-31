import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { addConstructionDrawingController } from './add-construction-drawing.js'
import Boom from '@hapi/boom'

describe('PATCH /marine-licence/add-construction-drawing', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const buildPayload = (overrides = {}) => ({
    id: new ObjectId().toHexString(),
    siteIndex: 0,
    ...mockAuditPayload,
    ...overrides
  })

  describe('handler', () => {
    it('should add an empty construction drawing to the correct site', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload()

      const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        updateOne: mockUpdateOne
      }))

      await addConstructionDrawingController.handler(
        { db: mockMongo, payload: mockPayload },
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith({ message: 'success' })
      expect(mockMongo.collection).toHaveBeenCalledWith('marine-licences')
      expect(mockUpdateOne).toHaveBeenCalledWith(
        {
          _id: ObjectId.createFromHexString(mockPayload.id),
          'siteDetails.0': { $exists: true }
        },
        {
          $push: { 'siteDetails.0.constructionDrawings': {} },
          $set: { siteDetailsConfirmed: false, ...mockAuditPayload }
        }
      )
    })

    it('should throw 404 when marine licence not found or site index is invalid', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload({ siteIndex: 99 })

      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }))

      vi.spyOn(Boom, 'notFound')

      await expect(() =>
        addConstructionDrawingController.handler(
          { db: mockMongo, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow('Marine licence not found or invalid site index')
    })

    it('should throw a 500 when the database operation fails', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload()
      const mockError = 'Database exploded'

      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }))

      await expect(() =>
        addConstructionDrawingController.handler(
          { db: mockMongo, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow(`Error adding construction drawing: ${mockError}`)
    })
  })
})
