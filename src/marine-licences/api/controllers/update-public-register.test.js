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
    ['the reason is missing', { withholdConsent: 'yes' }],
    ['the reason is empty', { withholdConsent: 'yes', withholdReason: '' }],
    [
      'the reason is not a known reason',
      { withholdConsent: 'yes', withholdReason: 'other' }
    ]
  ])(
    'should fail if information is withheld and %s',
    (_description, payload) => {
      const result = payloadValidator.validate(payload)
      expect(result.error.message).toContain(
        'PUBLIC_REGISTER_WITHHOLD_REASON_REQUIRED'
      )
    }
  )

  it.each(['nationalSecurity', 'commercialConfidentiality'])(
    'should pass if information is withheld for %s',
    (withholdReason) => {
      const result = payloadValidator.validate({
        id: new ObjectId().toHexString(),
        withholdConsent: 'yes',
        withholdReason
      })
      expect(result.error).toBeUndefined()
    }
  )

  it.each([
    ['1,000 emoji', '👍🏽'.repeat(1000)],
    ['999 characters with CRLF line breaks', 'a\r\n'.repeat(499) + 'a'],
    ['1,000 characters with trailing whitespace', 'a'.repeat(1000) + '  \r\n']
  ])('should accept a reason of %s', (_description, reason) => {
    const result = payloadValidator.validate({
      id: new ObjectId().toHexString(),
      withholdConsent: 'yes',
      reason
    })
    expect(result.error).toBeUndefined()
  })

  it('should fail if the reason is stored in more than 10,000 code units', () => {
    const result = payloadValidator.validate({
      withholdConsent: 'yes',
      reason: ('a' + '\u0301'.repeat(20)).repeat(500)
    })
    expect(result.error.message).toContain('PUBLIC_REGISTER_REASON_MAX_LENGTH')
  })

  it('should fail if a reason is given when nothing is withheld', () => {
    const result = payloadValidator.validate({
      withholdConsent: 'no',
      withholdReason: 'nationalSecurity'
    })
    expect(result.error.message).toContain('"withholdReason" is not allowed')
  })

  it('should fail if the old free-text reason is sent', () => {
    const result = payloadValidator.validate({
      id: new ObjectId().toHexString(),
      withholdConsent: 'yes',
      withholdReason: 'nationalSecurity',
      reason: 'Free text'
    })
    expect(result.error.message).toContain('"reason" is not allowed')
  })

  it('should return a 404 if the licence is deleted before the update runs', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      withholdConsent: 'yes',
      withholdReason: 'nationalSecurity',
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
      withholdReason: 'nationalSecurity',
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
