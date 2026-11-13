import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updatePublicRegisterNationalSecurityController } from './update-public-register-national-security.js'

describe('PATCH /marine-licence/public-register/national-security', () => {
  const payloadValidator =
    updatePublicRegisterNationalSecurityController.options.validate.payload
  const id = new ObjectId().toHexString()

  it.each([
    ['the answer is missing', {}],
    ['the answer is empty', { nationalSecurityApproval: '' }],
    ['the answer is not yes or no', { nationalSecurityApproval: 'maybe' }]
  ])('should fail if %s', (_description, payload) => {
    const result = payloadValidator.validate({ id, ...payload })
    expect(result.error.message).toContain(
      'PUBLIC_REGISTER_NATIONAL_SECURITY_APPROVAL_REQUIRED'
    )
  })

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['only whitespace', '   ']
  ])('should fail if approved and the reason is %s', (_description, reason) => {
    const result = payloadValidator.validate({
      id,
      nationalSecurityApproval: 'yes',
      reason
    })
    expect(result.error.message).toContain(
      'PUBLIC_REGISTER_NATIONAL_SECURITY_REASON_REQUIRED'
    )
  })

  it('should pass with a reason of exactly 1000 user-perceived characters', () => {
    const result = payloadValidator.validate({
      id,
      nationalSecurityApproval: 'yes',
      reason: '👍🏽'.repeat(1000)
    })
    expect(result.error).toBeUndefined()
  })

  it('should fail with a reason of 1001 characters', () => {
    const result = payloadValidator.validate({
      id,
      nationalSecurityApproval: 'yes',
      reason: 'a'.repeat(1001)
    })
    expect(result.error.message).toContain(
      'PUBLIC_REGISTER_NATIONAL_SECURITY_REASON_MAX_LENGTH'
    )
  })

  it('should fail if a reason is given without approval', () => {
    const result = payloadValidator.validate({
      id,
      nationalSecurityApproval: 'no',
      reason: 'Details'
    })
    expect(result.error.message).toContain('"reason" is not allowed')
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(new Error('Database failed'))
      }
    })

    await expect(() =>
      updatePublicRegisterNationalSecurityController.handler(
        { db: mockMongo, payload: { id, nationalSecurityApproval: 'no' } },
        mockHandler
      )
    ).rejects.toThrow(
      'Error updating public register national security: Database failed'
    )
  })
})
