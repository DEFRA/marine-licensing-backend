import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updateSiteNoticeEvidenceController } from './update-site-notice-evidence.js'

describe('PATCH /marine-licence/update-site-notice-evidence', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const buildPayload = (overrides = {}) => ({
    id: new ObjectId().toHexString(),
    evidenceIndex: 0,
    ...mockAuditPayload,
    ...overrides
  })

  describe('handler', () => {
    it('should set only the fields present in the payload', async () => {
      const { mockMongo, mockHandler } = global
      const dateDisplayed = { day: '01', month: '05', year: '2026' }
      const mockPayload = buildPayload({
        evidenceIndex: 1,
        locationName: 'North pier',
        dateDisplayed
      })

      const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        updateOne: mockUpdateOne
      }))

      await updateSiteNoticeEvidenceController.handler(
        { db: mockMongo, payload: mockPayload },
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith({ message: 'success' })
      expect(mockUpdateOne).toHaveBeenCalledWith(
        {
          _id: ObjectId.createFromHexString(mockPayload.id),
          'siteNoticeEvidence.1': { $exists: true }
        },
        {
          $set: {
            'siteNoticeEvidence.1.locationName': 'North pier',
            'siteNoticeEvidence.1.dateDisplayed': dateDisplayed,
            ...mockAuditPayload
          }
        }
      )
    })

    it('should throw 404 when the evidence index does not exist', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload({
        evidenceIndex: 4,
        locationName: 'North pier'
      })

      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }))

      await expect(() =>
        updateSiteNoticeEvidenceController.handler(
          { db: mockMongo, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow('invalid evidence index of 4')
    })

    it('should throw a 500 when the database operation fails', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload({ locationName: 'North pier' })
      const mockError = 'Database exploded'

      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }))

      await expect(() =>
        updateSiteNoticeEvidenceController.handler(
          { db: mockMongo, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow(`Error updating site notice evidence: ${mockError}`)
    })
  })
})
