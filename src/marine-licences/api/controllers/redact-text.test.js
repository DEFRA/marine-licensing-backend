import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { redactTextController } from './redact-text.js'
import { redactText } from '../../models/redact-text.js'
import { mockRedactions } from '../../../../tests/test.fixture.js'

describe('POST /marine-licence/redact-text', () => {
  const { redactedAt, redactedBy, redactedText } = mockRedactions.preferredDates

  const mockAuditPayload = {
    updatedAt: redactedAt,
    updatedBy: 'should-not-be-used'
  }

  const entraAuth = {
    credentials: { contactId: redactedBy },
    artifacts: { decoded: { tid: 'abc', oid: redactedBy } }
  }

  const defraIdAuth = {
    credentials: { contactId: 'applicant123' },
    artifacts: { decoded: { contactId: 'applicant123' } }
  }

  const createPayload = (overrides = {}) => ({
    id: new ObjectId().toHexString(),
    fieldKey: 'preferredDates',
    text: redactedText,
    ...mockAuditPayload,
    ...overrides
  })

  it('should validate the payload with the redactText schema', () => {
    expect(redactTextController.options.validate.payload).toBe(redactText)
  })

  describe('handler', () => {
    it('should store the redaction against the field key', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = createPayload()

      const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return { updateOne: mockUpdateOne }
      })

      await redactTextController.handler(
        { db: mockMongo, payload: mockPayload, auth: entraAuth },
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'success' })
      )
      expect(mockMongo.collection).toHaveBeenCalledWith('marine-licences')
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: ObjectId.createFromHexString(mockPayload.id) },
        { $set: { 'redactions.preferredDates': mockRedactions.preferredDates } }
      )
    })

    it('should not allow a non Entra ID user to save', async () => {
      const { mockMongo, mockHandler } = global
      const mockUpdateOne = vi.fn()
      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return { updateOne: mockUpdateOne }
      })

      await expect(() =>
        redactTextController.handler(
          { db: mockMongo, payload: createPayload(), auth: defraIdAuth },
          mockHandler
        )
      ).rejects.toThrow('Not authorised to redact data')

      expect(mockUpdateOne).not.toHaveBeenCalled()
    })

    it('should return a 404 if the marine licence does not exist', async () => {
      const { mockMongo, mockHandler } = global

      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return {
          updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
        }
      })

      await expect(() =>
        redactTextController.handler(
          { db: mockMongo, payload: createPayload(), auth: entraAuth },
          mockHandler
        )
      ).rejects.toThrow('Marine licence not found')
    })

    it('should return an error message if the database operation fails', async () => {
      const { mockMongo, mockHandler } = global
      const mockError = 'Database failed'

      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return {
          updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
        }
      })

      await expect(() =>
        redactTextController.handler(
          { db: mockMongo, payload: createPayload(), auth: entraAuth },
          mockHandler
        )
      ).rejects.toThrow(`Error redacting data: ${mockError}`)
    })
  })
})
