import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { saveMarinePlanPolicyResponseController } from './save-marine-plan-policy-response.js'
import {
  POLICY_CONSIDERATION_MAX_LENGTH,
  POLICY_CONSIDERATION_MIN_LENGTH
} from '../../models/marine-plan-policy.js'

const validResponse =
  'Our activity complies with this policy because it avoids sensitive habitats.'

describe('PATCH /marine-licence/marine-plan-policy-response', () => {
  const payloadValidator =
    saveMarinePlanPolicyResponseController.options.validate.payload
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const buildPayload = (overrides = {}) => ({
    id: new ObjectId().toHexString(),
    policyCode: 'S-FISH-1',
    response: validResponse,
    ...mockAuditPayload,
    ...overrides
  })

  const setupMocks = (result) => {
    const { mockMongo } = global
    const mockUpdateOne = vi.fn().mockResolvedValue(result)
    vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
      updateOne: mockUpdateOne
    }))
    return mockUpdateOne
  }

  describe('validation', () => {
    const buildValidationPayload = (overrides = {}) => ({
      id: new ObjectId().toHexString(),
      policyCode: 'S-FISH-1',
      response: validResponse,
      ...overrides
    })

    it('should require a policy id', () => {
      const result = payloadValidator.validate(
        buildValidationPayload({ policyCode: undefined })
      )
      expect(result.error.message).toContain('POLICY_CODE_REQUIRED')
    })

    it('should require a response field', () => {
      const result = payloadValidator.validate(
        buildValidationPayload({ response: undefined })
      )
      expect(result.error.message).toContain('POLICY_RESPONSE_REQUIRED')
    })

    it('should allow an empty response so the applicant can clear it', () => {
      const result = payloadValidator.validate(
        buildValidationPayload({ response: '' })
      )
      expect(result.error).toBeUndefined()
    })

    it('should reject a response over the maximum length', () => {
      const result = payloadValidator.validate(
        buildValidationPayload({
          response: 'x'.repeat(POLICY_CONSIDERATION_MAX_LENGTH + 1)
        })
      )
      expect(result.error.message).toContain('POLICY_CONSIDERATION_MAX_LENGTH')
    })

    it('should reject a response under the minimum length', () => {
      const result = payloadValidator.validate(
        buildValidationPayload({
          response: 'x'.repeat(POLICY_CONSIDERATION_MIN_LENGTH - 1)
        })
      )
      expect(result.error.message).toContain('POLICY_CONSIDERATION_MIN_LENGTH')
    })

    it('should accept a response at exactly the minimum length', () => {
      const result = payloadValidator.validate(
        buildValidationPayload({
          response: 'x'.repeat(POLICY_CONSIDERATION_MIN_LENGTH)
        })
      )
      expect(result.error).toBeUndefined()
    })

    it('should default requiresDocumentation to false when the checkbox is not ticked', () => {
      const result = payloadValidator.validate(buildValidationPayload())
      expect(result.value.requiresDocumentation).toBe(false)
    })

    it('should accept requiresDocumentation when ticked', () => {
      const result = payloadValidator.validate(
        buildValidationPayload({ requiresDocumentation: true })
      )
      expect(result.error).toBeUndefined()
      expect(result.value.requiresDocumentation).toBe(true)
    })

    it('should reject a non-boolean requiresDocumentation', () => {
      const result = payloadValidator.validate(
        buildValidationPayload({ requiresDocumentation: 'maybe' })
      )
      expect(result.error.message).toContain('REQUIRES_DOCUMENTATION_INVALID')
    })
  })

  describe('handler', () => {
    it('should save a policy response using a single update operation', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload({ requiresDocumentation: true })
      const mockUpdateOne = setupMocks({ matchedCount: 1 })

      await saveMarinePlanPolicyResponseController.handler(
        { db: mockMongo, payload: mockPayload },
        mockHandler
      )

      expect(mockUpdateOne).toHaveBeenCalledTimes(1)
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: ObjectId.createFromHexString(mockPayload.id) },
        [
          {
            $set: {
              marinePlanPolicyResponses: {
                $mergeObjects: [
                  '$marinePlanPolicyResponses',
                  {
                    'S-FISH-1': {
                      $literal: {
                        response: mockPayload.response,
                        requiresDocumentation: true
                      }
                    }
                  }
                ]
              },
              ...mockAuditPayload
            }
          },
          {
            $set: {
              marinePlanPolicyResponseCount: {
                $size: {
                  $filter: {
                    input: { $objectToArray: '$marinePlanPolicyResponses' },
                    as: 'r',
                    cond: { $ne: ['$$r.v.response', ''] }
                  }
                }
              }
            }
          }
        ]
      )
      expect(mockHandler.response).toHaveBeenCalledWith({ message: 'success' })
    })

    it('should throw 404 when the marine licence does not exist', async () => {
      const { mockMongo, mockHandler } = global
      setupMocks({ matchedCount: 0 })

      await expect(() =>
        saveMarinePlanPolicyResponseController.handler(
          { db: mockMongo, payload: buildPayload() },
          mockHandler
        )
      ).rejects.toThrow('Marine licence not found')
    })

    it('should throw 500 when the database operation fails', async () => {
      const { mockMongo, mockHandler } = global
      const mockUpdateOne = vi
        .fn()
        .mockRejectedValueOnce(new Error('Database exploded'))
      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        updateOne: mockUpdateOne
      }))

      await expect(() =>
        saveMarinePlanPolicyResponseController.handler(
          { db: mockMongo, payload: buildPayload() },
          mockHandler
        )
      ).rejects.toThrow('Error saving policy response: Database exploded')
    })
  })
})
