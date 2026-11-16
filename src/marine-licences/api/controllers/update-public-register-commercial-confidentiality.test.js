import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updatePublicRegisterCommercialConfidentialityController } from './update-public-register-commercial-confidentiality.js'

describe('PATCH /marine-licence/public-register-commercial-confidentiality', () => {
  const payloadValidator =
    updatePublicRegisterCommercialConfidentialityController.options.validate
      .payload
  const id = new ObjectId().toHexString()
  const choice = {
    withholdConsent: 'yes',
    withholdReason: 'commercialConfidentiality'
  }

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['only whitespace', '  \r\n  ']
  ])('should fail if the reason is %s', (_description, reason) => {
    const result = payloadValidator.validate({ id, ...choice, reason })
    expect(result.error.message).toContain(
      'PUBLIC_REGISTER_COMMERCIAL_CONFIDENTIALITY_REASON_REQUIRED'
    )
  })

  it('should pass with a reason of exactly 1000 user-perceived characters', () => {
    const result = payloadValidator.validate({
      id,
      ...choice,
      reason: '👍🏽'.repeat(1000)
    })
    expect(result.error).toBeUndefined()
  })

  it('should count a line break as one character', () => {
    const result = payloadValidator.validate({
      id,
      ...choice,
      reason: 'a'.repeat(499) + '\r\n' + 'a'.repeat(500)
    })
    expect(result.error).toBeUndefined()
  })

  it('should fail with a reason of 1001 characters', () => {
    const result = payloadValidator.validate({
      id,
      ...choice,
      reason: 'a'.repeat(1001)
    })
    expect(result.error.message).toContain(
      'PUBLIC_REGISTER_COMMERCIAL_CONFIDENTIALITY_REASON_MAX_LENGTH'
    )
  })

  it.each([
    ['consent is missing', { withholdConsent: undefined }],
    ['consent is no', { withholdConsent: 'no' }],
    ['the withhold reason is missing', { withholdReason: undefined }],
    [
      'the withhold reason is not commercial confidentiality',
      { withholdReason: 'nationalSecurity' }
    ]
  ])('should fail if %s', (_description, override) => {
    const result = payloadValidator.validate({
      id,
      ...choice,
      reason: 'Details',
      ...override
    })
    expect(result.error).toBeDefined()
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(new Error('Database failed'))
      }
    })

    await expect(() =>
      updatePublicRegisterCommercialConfidentialityController.handler(
        { db: mockMongo, payload: { id, ...choice, reason: 'Details' } },
        mockHandler
      )
    ).rejects.toThrow(
      'Error updating public register commercial confidentiality: Database failed'
    )
  })
})
