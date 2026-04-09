import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { addActivityDetailsController } from './add-activity-details.js'
import { createActivityDetails } from '../helpers/create-empty-activity-details.js'
import Boom from '@hapi/boom'

describe('PATCH /marine-licence/add-activity-details', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const emptyActivityDetails = createActivityDetails()

  const buildPayload = (overrides = {}) => ({
    id: new ObjectId().toHexString(),
    siteIndex: 0,
    ...mockAuditPayload,
    ...overrides
  })

  describe('handler', () => {
    it('should add activity details to the correct site', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload()

      const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        updateOne: mockUpdateOne
      }))

      await addActivityDetailsController.handler(
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
          $push: { 'siteDetails.0.activityDetails': emptyActivityDetails },
          $set: mockAuditPayload
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
        addActivityDetailsController.handler(
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
        addActivityDetailsController.handler(
          { db: mockMongo, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow(`Error adding activity details: ${mockError}`)
    })
  })
})
