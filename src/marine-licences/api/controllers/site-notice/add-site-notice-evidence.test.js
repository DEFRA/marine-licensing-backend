import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { addSiteNoticeEvidenceController } from './add-site-notice-evidence.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'

describe('POST /marine-licence/add-site-notice-evidence', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2026-05-21T12:00:00.000Z'),
    updatedBy: 'user123'
  }

  const mockPayload = {
    id: new ObjectId().toHexString(),
    ...mockAuditPayload
  }

  test('should update marine licence with site notice evidence', async () => {
    const { mockMongo, mockHandler } = global

    const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return { updateOne: mockUpdateOne }
    })

    await addSiteNoticeEvidenceController.handler(
      { db: mockMongo, payload: mockPayload },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'success' })
    )
    expect(mockMongo.collection).toHaveBeenCalledWith(collectionMarineLicences)
    expect(mockUpdateOne).toHaveBeenCalledWith(
      {
        _id: ObjectId.createFromHexString(mockPayload.id),
        'siteNoticeEvidence.29': { $exists: false }
      },
      {
        $push: {
          siteNoticeEvidence: {}
        },
        $set: mockAuditPayload
      }
    )
  })

  test('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      ...mockAuditPayload
    }

    const mockError = 'Database failed'
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      addSiteNoticeEvidenceController.handler(
        { db: mockMongo, payload: mockPayload },
        mockHandler
      )
    ).rejects.toThrow(`Error adding site notice evidence: ${mockError}`)
  })

  test('should return a 409 if the evidence cap has been reached', async () => {
    const { mockMongo, mockHandler } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }
    })

    await expect(() =>
      addSiteNoticeEvidenceController.handler(
        { db: mockMongo, payload: mockPayload },
        mockHandler
      )
    ).rejects.toThrow(
      'already has the maximum of 30 site notice evidence entries'
    )
  })
})
