import { invoiceContactDetailsSchema } from './invoice-contact-details.js'

describe('invoiceContactDetailsSchema', () => {
  const validPayload = {
    fullName: 'Test Person',
    organisationName: 'Test Organisation',
    phoneNumber: '01234 567890',
    emailAddress: 'test@example.com'
  }

  test('should pass with valid data', () => {
    const { error } = invoiceContactDetailsSchema.validate(validPayload)
    expect(error).toBeUndefined()
  })

  test('should error when fullName is missing', () => {
    const { error } = invoiceContactDetailsSchema.validate({
      ...validPayload,
      fullName: undefined
    })
    expect(error.message).toContain('INVOICING_CONTACT_FULL_NAME_REQUIRED')
  })

  test('should error when fullName is too long', () => {
    const { error } = invoiceContactDetailsSchema.validate({
      ...validPayload,
      fullName: 'a'.repeat(101)
    })
    expect(error.message).toContain('INVOICING_CONTACT_FULL_NAME_MAX_LENGTH')
  })

  test('should error when organisationName is missing', () => {
    const { error } = invoiceContactDetailsSchema.validate({
      ...validPayload,
      organisationName: undefined
    })
    expect(error.message).toContain(
      'INVOICING_CONTACT_ORGANISATION_NAME_REQUIRED'
    )
  })

  test('should error when organisationName is too long', () => {
    const { error } = invoiceContactDetailsSchema.validate({
      ...validPayload,
      organisationName: 'a'.repeat(101)
    })
    expect(error.message).toContain(
      'INVOICING_CONTACT_ORGANISATION_NAME_MAX_LENGTH'
    )
  })

  test('should error when phoneNumber is missing', () => {
    const { error } = invoiceContactDetailsSchema.validate({
      ...validPayload,
      phoneNumber: undefined
    })
    expect(error.message).toContain('INVOICING_CONTACT_PHONE_NUMBER_REQUIRED')
  })

  test('should pass with any non-empty phoneNumber string', () => {
    const { error } = invoiceContactDetailsSchema.validate({
      ...validPayload,
      phoneNumber: 'not a real phone number'
    })
    expect(error).toBeUndefined()
  })

  test('should error when emailAddress is missing', () => {
    const { error } = invoiceContactDetailsSchema.validate({
      ...validPayload,
      emailAddress: undefined
    })
    expect(error.message).toContain(
      'INVOICING_CONTACT_EMAIL_ADDRESS_REQUIRED'
    )
  })

  test('should error when emailAddress is invalid', () => {
    const { error } = invoiceContactDetailsSchema.validate({
      ...validPayload,
      emailAddress: 'not-an-email'
    })
    expect(error.message).toContain('INVOICING_CONTACT_EMAIL_ADDRESS_INVALID')
  })

  test('should error when emailAddress is too long', () => {
    const { error } = invoiceContactDetailsSchema.validate({
      ...validPayload,
      emailAddress: `${'a'.repeat(255)}@example.com`
    })
    expect(error.message).toContain(
      'INVOICING_CONTACT_EMAIL_ADDRESS_MAX_LENGTH'
    )
  })
})
