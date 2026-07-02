import { harbourAuthoritySchema } from './harbour-authority.js'
import { mockMarineLicence } from './test-fixtures.js'

describe('harbourAuthoritySchema', () => {
  const validPayload = {
    area: 'yes',
    details: 'Harbour authority details',
    id: mockMarineLicence._id.toHexString()
  }

  test('should pass with valid data', () => {
    const { error } = harbourAuthoritySchema.validate(validPayload)
    expect(error).toBeUndefined()
  })

  test('should error when no selection provided', () => {
    const { error } = harbourAuthoritySchema.validate({
      ...validPayload,
      area: undefined
    })
    expect(error.message).toContain('HARBOUR_AUTHORITY_REQUIRED')
  })

  test('should error when yes is answered but details is missing', () => {
    const { error } = harbourAuthoritySchema.validate({
      ...validPayload,
      details: undefined
    })
    expect(error.message).toContain('HARBOUR_AUTHORITY_DETAILS_REQUIRED')
  })

  test('should not error when no is selected and details is not provided', () => {
    const { error } = harbourAuthoritySchema.validate({
      ...validPayload,
      area: 'no',
      details: undefined
    })
    expect(error).toBeUndefined()
  })

  test('should error when no is selected but details is provided', () => {
    const { error } = harbourAuthoritySchema.validate({
      ...validPayload,
      area: 'no'
    })
    expect(error.message).toContain('HARBOUR_AUTHORITY_DETAILS_NOT_ALLOWED')
  })

  test('should error when details is too long', () => {
    const { error } = harbourAuthoritySchema.validate({
      ...validPayload,
      details: 'a'.repeat(1001)
    })
    expect(error.message).toContain('HARBOUR_AUTHORITY_DETAILS_MAX_LENGTH')
  })
})
