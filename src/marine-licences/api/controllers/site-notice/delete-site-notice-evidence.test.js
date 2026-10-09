import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { deleteSiteNoticeEvidenceController } from './delete-site-notice-evidence.js'

describe('PATCH /marine-licence/delete-site-notice-evidence', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const existingUpdatedAt = new Date('2024-12-01T10:00:00Z')
  const mockId = new ObjectId().toHexString()

  const buildPayload = (overrides = {}) => ({
    id: mockId,
    evidenceIndex: 1,
    ...mockAuditPayload,
    ...overrides
  })

  const buildMarineLicence = () => ({
    updatedAt: existingUpdatedAt,
    siteNoticeEvidence: [{}, {}]
  })

  describe('handler', () => {
    it('should delete the site notice evidence at the given index', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload()

      const mockFindOne = vi.fn().mockResolvedValueOnce(buildMarineLicence())
      const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        findOne: mockFindOne,
        updateOne: mockUpdateOne
      }))

      await deleteSiteNoticeEvidenceController.handler(
        { db: mockMongo, payload: mockPayload },
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith({ message: 'success' })
      expect(mockFindOne).toHaveBeenCalledWith({
        _id: ObjectId.createFromHexString(mockId),
        'siteNoticeEvidence.1': { $exists: true }
      })
      expect(mockUpdateOne).toHaveBeenCalledTimes(1)
      expect(mockUpdateOne).toHaveBeenCalledWith(
        {
          _id: ObjectId.createFromHexString(mockId),
          updatedAt: existingUpdatedAt
        },
        [
          {
            $set: {
              siteNoticeEvidence: {
                $concatArrays: [
                  { $slice: ['$siteNoticeEvidence', 1] },
                  {
                    $slice: [
                      '$siteNoticeEvidence',
                      2,
                      { $size: '$siteNoticeEvidence' }
                    ]
                  }
                ]
              },
              ...mockAuditPayload
            }
          }
        ]
      )
    })

    it('should throw 404 when the evidence index does not exist', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload({ evidenceIndex: 99 })

      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        findOne: vi.fn().mockResolvedValueOnce(null)
      }))

      await expect(() =>
        deleteSiteNoticeEvidenceController.handler(
          { db: mockMongo, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow(
        `Site notice evidence not found for evidence index 99 for Marine Licence ${mockId}`
      )
    })

    it('should throw 409 when the document was modified by another user', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload()

      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        findOne: vi.fn().mockResolvedValueOnce(buildMarineLicence()),
        updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }))

      await expect(() =>
        deleteSiteNoticeEvidenceController.handler(
          { db: mockMongo, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow('was modified by another user')
    })

    it('should throw a 500 when the database operation fails', async () => {
      const { mockMongo, mockHandler } = global
      const mockError = 'Database failed'

      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        findOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }))

      await expect(() =>
        deleteSiteNoticeEvidenceController.handler(
          { db: mockMongo, payload: buildPayload() },
          mockHandler
        )
      ).rejects.toThrow(`Error deleting site notice evidence: ${mockError}`)
    })
  })
})
