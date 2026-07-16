import { internationalInvoiceAddressSchema } from './international-invoice-address.js'

describe('internationalInvoiceAddressSchema', () => {
  const validPayload = {
    country: 'France',
    address: '1 Rue de Test'
  }

  test('should pass with valid data', () => {
    const { error } = internationalInvoiceAddressSchema.validate(validPayload)
    expect(error).toBeUndefined()
  })

  test('should error when country is missing', () => {
    const { error } = internationalInvoiceAddressSchema.validate({
      ...validPayload,
      country: undefined
    })
    expect(error.message).toContain('INVOICING_COUNTRY_REQUIRED')
  })

  test('should error when address is missing', () => {
    const { error } = internationalInvoiceAddressSchema.validate({
      ...validPayload,
      address: undefined
    })
    expect(error.message).toContain('INVOICING_ADDRESS_REQUIRED')
  })

  test('should error when address is too long', () => {
    const { error } = internationalInvoiceAddressSchema.validate({
      ...validPayload,
      address: 'a'.repeat(301)
    })
    expect(error.message).toContain('INVOICING_ADDRESS_MAX_LENGTH')
  })

  test('should pass when address exceeds max length', () => {
    const { error } = internationalInvoiceAddressSchema.validate({
      ...validPayload,
      address: 'a'.repeat(300)
    })
    expect(error).toBeUndefined()
  })
})
