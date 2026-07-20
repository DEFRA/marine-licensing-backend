import { ukInvoiceAddressSchema } from './uk-invoice-address.js'

describe('ukInvoiceAddressSchema', () => {
  const validPayload = {
    addressLine1: '1 Test Street',
    addressTown: 'Test town',
    addressPostcode: 'TE1 1ST'
  }

  test('should pass with valid data', () => {
    const { error } = ukInvoiceAddressSchema.validate(validPayload)
    expect(error).toBeUndefined()
  })

  test('should pass with optional fields provided', () => {
    const { error } = ukInvoiceAddressSchema.validate({
      ...validPayload,
      addressLine2: 'Flat 2',
      addressCounty: 'Test county'
    })
    expect(error).toBeUndefined()
  })

  test('should pass with optional fields as empty strings', () => {
    const { error } = ukInvoiceAddressSchema.validate({
      ...validPayload,
      addressLine2: '',
      addressCounty: ''
    })
    expect(error).toBeUndefined()
  })

  test('should error when addressLine1 is missing', () => {
    const { error } = ukInvoiceAddressSchema.validate({
      ...validPayload,
      addressLine1: undefined
    })
    expect(error.message).toContain('ADDRESS_LINE_1_REQUIRED')
  })

  test('should error when addressLine1 is too long', () => {
    const { error } = ukInvoiceAddressSchema.validate({
      ...validPayload,
      addressLine1: 'a'.repeat(101)
    })
    expect(error.message).toContain('ADDRESS_LINE_1_MAX_LENGTH')
  })

  test('should error when addressLine2 is too long', () => {
    const { error } = ukInvoiceAddressSchema.validate({
      ...validPayload,
      addressLine2: 'a'.repeat(101)
    })
    expect(error.message).toContain('ADDRESS_LINE_2_MAX_LENGTH')
  })

  test('should error when addressTown is missing', () => {
    const { error } = ukInvoiceAddressSchema.validate({
      ...validPayload,
      addressTown: undefined
    })
    expect(error.message).toContain('ADDRESS_TOWN_REQUIRED')
  })

  test('should error when addressTown is too long', () => {
    const { error } = ukInvoiceAddressSchema.validate({
      ...validPayload,
      addressTown: 'a'.repeat(31)
    })
    expect(error.message).toContain('ADDRESS_TOWN_MAX_LENGTH')
  })

  test('should error when addressCounty is too long', () => {
    const { error } = ukInvoiceAddressSchema.validate({
      ...validPayload,
      addressCounty: 'a'.repeat(51)
    })
    expect(error.message).toContain('ADDRESS_COUNTY_MAX_LENGTH')
  })

  test('should error when postcode is missing', () => {
    const { error } = ukInvoiceAddressSchema.validate({
      ...validPayload,
      addressPostcode: undefined
    })
    expect(error.message).toContain('ADDRESS_POSTCODE_REQUIRED')
  })

  test.each(['TE1', 'NOT A POSTCODE', '12345'])(
    'should error when postcode "%s" is invalid',
    (addressPostcode) => {
      const { error } = ukInvoiceAddressSchema.validate({
        ...validPayload,
        addressPostcode
      })
      expect(error.message).toContain('ADDRESS_POSTCODE_INVALID')
    }
  )

  test.each(['TE1 1ST', 'te1 1st', 'M1 1AE', 'SW1A 1AA', 'EC1A 1BB'])(
    'should pass when postcode "%s" is valid',
    (addressPostcode) => {
      const { error } = ukInvoiceAddressSchema.validate({
        ...validPayload,
        addressPostcode
      })
      expect(error).toBeUndefined()
    }
  )
})
