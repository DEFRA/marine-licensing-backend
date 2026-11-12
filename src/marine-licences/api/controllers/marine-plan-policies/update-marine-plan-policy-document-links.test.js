import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updateMarinePlanPolicyDocumentLinksController } from './update-marine-plan-policy-document-links.js'
import { mockLinkedMarinePlanPolicyDocument } from '../../../../../tests/test.fixture.js'

describe('PATCH /marine-licence/marine-plan-policy-document-links', () => {
  const buildPayload = (overrides = {}) => ({
    id: new ObjectId().toHexString(),
    documentId: mockLinkedMarinePlanPolicyDocument.documentId,
    policyLinks: mockLinkedMarinePlanPolicyDocument.policyLinks,
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123',
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
        updateMarinePlanPolicyDocumentLinksController.handler(
          { db: mockMongo, payload: buildPayload() },
          mockHandler
        )
      ).rejects.toThrow(
        'Error updating marine plan policy document links: Database error'
      )
    })
  })
})
