import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { deleteSupportingDocumentController } from './delete-supporting-document.js'

const uuid = '123e4567-e89b-12d3-a456-426614174000'

describe('PATCH /marine-licence/marine-plan-policy-document-type', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const buildPayload = (overrides = {}) => ({
    id: new ObjectId().toHexString(),
    documentId: uuid,
    ...mockAuditPayload
  })

  describe('handler', () => {
    test('should throw 500 when the database operation fails', async () => {
      const { mockMongo, mockHandler } = global
      const mockFindOne = vi
        .fn()
        .mockRejectedValueOnce(new Error('Database error'))
      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        findOne: mockFindOne
      }))

      await expect(() =>
        deleteSupportingDocumentController.handler(
          { db: mockMongo, payload: buildPayload() },
          mockHandler
        )
      ).rejects.toThrow('Error deleting document: Database error')
    })

    test('should throw 500 when deleting the document fails', async () => {
      const { mockMongo, mockHandler } = global
      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        findOne: vi.fn().mockResolvedValue({
          marinePlanPolicyDocuments: [{ documentId: uuid }]
        }),
        updateOne: vi.fn().mockRejectedValue(new Error('Update failed'))
      }))

      await expect(() =>
        deleteSupportingDocumentController.handler(
          { db: mockMongo, payload: buildPayload() },
          mockHandler
        )
      ).rejects.toThrow('Error deleting document: Update failed')
    })
  })
})
