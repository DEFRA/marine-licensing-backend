import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updatePublicRegisterController } from './update-public-register.js'

describe('PATCH /marine-licence/public-register', () => {
  const payloadValidator =
    updatePublicRegisterController.options.validate.payload

  it.each([
    ['fields are missing', {}],
    ['withholdConsent is not a valid value', { withholdConsent: 'maybe' }],
    ['withholdConsent is empty string', { withholdConsent: '' }]
  ])('should fail if %s', (_description, payload) => {
    const result = payloadValidator.validate(payload)
    expect(result.error.message).toContain(
      'PUBLIC_REGISTER_WITHHOLD_CONSENT_REQUIRED'
    )
  })

  it.each([
    ['reason is missing', { withholdConsent: 'yes' }],
    ['reason is only whitespace', { withholdConsent: 'yes', reason: '   ' }]
  ])(
    'should fail if information is withheld and %s',
    (_description, payload) => {
      const result = payloadValidator.validate(payload)
      expect(result.error.message).toContain('PUBLIC_REGISTER_REASON_REQUIRED')
    }
  )

  it('should fail if reason is longer than the maximum length', () => {
    const result = payloadValidator.validate({
      withholdConsent: 'yes',
      reason: 'a'.repeat(1001)
    })
    expect(result.error.message).toContain('PUBLIC_REGISTER_REASON_MAX_LENGTH')
  })

  it('should fail if a reason is given when nothing is withheld', () => {
    const result = payloadValidator.validate({
      withholdConsent: 'no',
      reason: 'A reason that should not be here'
    })
    expect(result.error.message).toContain('"reason" is not allowed')
  })

  it('should return a 404 if the licence is deleted before the update runs', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      withholdConsent: 'yes',
      reason: 'Reason for withholding information',
      updatedAt: new Date('2025-01-01T12:00:00Z'),
      updatedBy: 'user123'
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }
    })

    await expect(() =>
      updatePublicRegisterController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow('Marine licence not found')
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      withholdConsent: 'yes',
      reason: 'Reason for withholding information',
      updatedAt: new Date('2025-01-01T12:00:00Z'),
      updatedBy: 'user123'
    }

    const mockError = 'Database failed'

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      updatePublicRegisterController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow(`Error updating public register: ${mockError}`)
  })
})
