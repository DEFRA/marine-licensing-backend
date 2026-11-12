import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updateMarinePlanPolicyDocumentTypeController } from './update-marine-plan-policy-document-type.js'

const uuid = '123e4567-e89b-12d3-a456-426614174000'

describe('PATCH /marine-licence/marine-plan-policy-document-type', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const buildPayload = (overrides = {}) => ({
    id: new ObjectId().toHexString(),
    documentId: uuid,
    documentType: 'ecological-assessment',
    ...mockAuditPayload,
    ...overrides
  })

  describe('handler', () => {
    test('should throw 500 when the database operation fails', async () => {
      const { mockMongo, mockHandler } = global
      const mockUpdateOne = vi
        .fn()
        .mockRejectedValueOnce(new Error('Database error'))
      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        updateOne: mockUpdateOne
      }))

      await expect(() =>
        updateMarinePlanPolicyDocumentTypeController.handler(
          { db: mockMongo, payload: buildPayload() },
          mockHandler
        )
      ).rejects.toThrow(
        'Error updating marine plan policy document type: Database error'
      )
    })
  })
})
