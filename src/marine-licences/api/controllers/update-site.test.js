import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updateSiteController } from './update-site.js'
import { mockFileUploadSite } from '../../../../tests/test.fixture.js'
import Boom from '@hapi/boom'

describe('PATCH /marine-licence/site', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const buildPayload = (overrides = {}) => ({
    id: new ObjectId().toHexString(),
    siteIndex: 0,
    siteDetails: mockFileUploadSite,
    ...mockAuditPayload,
    ...overrides
  })

  describe('handler', () => {
    it('should update the site at the given index', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload()

      const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        updateOne: mockUpdateOne
      }))

      await updateSiteController.handler(
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
          $set: { 'siteDetails.0': mockFileUploadSite, ...mockAuditPayload }
        }
      )
    })

    it('should throw 404 when marine licence not found or site index is invalid', async () => {
      const { mockMongo, mockHandler } = global

      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }))

      vi.spyOn(Boom, 'notFound')

      await expect(() =>
        updateSiteController.handler(
          { db: mockMongo, payload: buildPayload({ siteIndex: 99 }) },
          mockHandler
        )
      ).rejects.toThrow('Marine licence not found or invalid site index')
    })

    it('should throw 500 when the database operation fails', async () => {
      const { mockMongo, mockHandler } = global
      const mockError = 'Database exploded'

      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }))

      await expect(() =>
        updateSiteController.handler(
          { db: mockMongo, payload: buildPayload() },
          mockHandler
        )
      ).rejects.toThrow(`Error updating site: ${mockError}`)
    })
  })
})
