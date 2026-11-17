import { ObjectId } from 'mongodb'
import { publicRegisterCommercialConfidentiality as payloadValidator } from './public-register-commercial-confidentiality.js'

describe('publicRegisterCommercialConfidentiality', () => {
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

  it('should fail if the withhold reason is not commercial confidentiality', () => {
    const result = payloadValidator.validate({
      id,
      ...choice,
      withholdReason: 'nationalSecurity',
      reason: 'Details'
    })
    expect(result.error).toBeDefined()
  })
})
