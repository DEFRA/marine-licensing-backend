import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { deleteActivityDetailsController } from './delete-activity-details.js'
import { createActivityDetails } from '../helpers/create-empty-activity-details.js'
import Boom from '@hapi/boom'

describe('PATCH /marine-licence/delete-activity-details', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const existingUpdatedAt = new Date('2024-12-01T10:00:00Z')
  const emptyActivity = createActivityDetails()
  const mockId = new ObjectId().toHexString()

  const buildPayload = (overrides = {}) => ({
    id: mockId,
    siteIndex: 0,
    activityIndex: 0,
    ...mockAuditPayload,
    ...overrides
  })

  const buildMarineLicence = (activities = [emptyActivity]) => ({
    updatedAt: existingUpdatedAt,
    siteDetails: [{ coordinatesType: 'manual', activityDetails: activities }]
  })

  describe('handler', () => {
    it('should delete the activity at the given index from the correct site', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload()

      const mockFindOne = vi.fn().mockResolvedValueOnce(buildMarineLicence())
      const mockUpdateOne = vi.fn().mockResolvedValue({ matchedCount: 1 })
      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        findOne: mockFindOne,
        updateOne: mockUpdateOne
      }))

      await deleteActivityDetailsController.handler(
        { db: mockMongo, payload: mockPayload },
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith({ message: 'success' })
      expect(mockFindOne).toHaveBeenCalledWith({
        _id: ObjectId.createFromHexString(mockPayload.id),
        'siteDetails.0.activityDetails.0': { $exists: true }
      })
      expect(mockUpdateOne).toHaveBeenNthCalledWith(
        1,
        {
          _id: ObjectId.createFromHexString(mockPayload.id),
          'siteDetails.0': { $exists: true },
          updatedAt: existingUpdatedAt
        },
        {
          $unset: { 'siteDetails.0.activityDetails.0': 1 },
          $set: mockAuditPayload
        }
      )
      expect(mockUpdateOne).toHaveBeenNthCalledWith(
        2,
        { _id: ObjectId.createFromHexString(mockPayload.id) },
        { $pull: { 'siteDetails.0.activityDetails': null } }
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
        deleteActivityDetailsController.handler(
          { db: mockMongo, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow(
        `Activity Details not found for site 99 and activity 0 for Marine Licence ${mockId}`
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
        deleteActivityDetailsController.handler(
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
        deleteActivityDetailsController.handler(
          { db: mockMongo, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow(`Error deleting activity details: ${mockError}`)
    })
  })
})
