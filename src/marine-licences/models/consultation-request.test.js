import { updateConsultationRequestSchema } from './consultation-request.js'
import { mockMarineLicence } from './test-fixtures.js'

describe('updateConsultationRequestSchema', () => {
  const validPayload = {
    id: mockMarineLicence._id.toHexString(),
    response: 'We have no objections'
  }

  test('should pass with valid data', () => {
    const { error } = updateConsultationRequestSchema.validate(validPayload)
    expect(error).toBeUndefined()
  })

  test('should allow a response of exactly 1000 characters', () => {
    const { error } = updateConsultationRequestSchema.validate({
      ...validPayload,
      response: 'a'.repeat(1000)
    })
    expect(error).toBeUndefined()
  })

  test.each([
    ['missing', undefined],
    ['blank', ''],
    ['only whitespace', '   '],
    ['not a string', 123]
  ])('should error when response is %s', (_, response) => {
    const { error } = updateConsultationRequestSchema.validate({
      ...validPayload,
      response
    })
    expect(error.message).toContain('CONSULTATION_RESPONSE_REQUIRED')
  })

  test('should error when response is over 1000 characters', () => {
    const { error } = updateConsultationRequestSchema.validate({
      ...validPayload,
      response: 'a'.repeat(1001)
    })
    expect(error.message).toContain('CONSULTATION_RESPONSE_MAX_LENGTH')
  })

  test('should error when id is missing', () => {
    const { error } = updateConsultationRequestSchema.validate({
      ...validPayload,
      id: undefined
    })
    expect(error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
  })
})
