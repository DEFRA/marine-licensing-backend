import { invoicingSchema } from './invoicing.js'
import { mockMarineLicence } from '../test-fixtures.js'

describe('invoicingSchema', () => {
  const validUkInvoiceAddress = {
    addressLine1: '1 Test Street',
    addressTown: 'Test town',
    addressPostcode: 'TE1 1ST'
  }

  const validPayload = {
    invoiceAddressType: 'uk',
    invoiceAddress: validUkInvoiceAddress,
    id: mockMarineLicence._id.toHexString()
  }

  test('should pass with valid data', () => {
    const { error } = invoicingSchema.validate(validPayload)
    expect(error).toBeUndefined()
  })

  test('should error when invoiceAddressType is missing', () => {
    const { error } = invoicingSchema.validate({
      ...validPayload,
      invoiceAddressType: undefined
    })
    expect(error.message).toContain('INVOICE_ADDRESS_TYPE_REQUIRED')
  })

  test('should error when invoiceAddressType is invalid', () => {
    const { error } = invoicingSchema.validate({
      ...validPayload,
      invoiceAddressType: 'incorrect'
    })
    expect(error.message).toContain('INVOICE_ADDRESS_TYPE_REQUIRED')
  })

  test('should error when id is missing', () => {
    const { error } = invoicingSchema.validate({
      invoiceAddressType: 'uk',
      invoiceAddress: validUkInvoiceAddress
    })
    expect(error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
  })

  test('should error when id is invalid', () => {
    const { error } = invoicingSchema.validate({
      ...validPayload,
      id: 'z'.repeat(24)
    })
    expect(error.message).toContain('MARINE_LICENCE_ID_INVALID')
  })

  describe('uk', () => {
    test('should error when invoiceAddress is missing', () => {
      const { error } = invoicingSchema.validate({
        ...validPayload,
        invoiceAddress: undefined
      })
      expect(error.message).toContain('"invoiceAddress" is required')
    })

    test('should error when addressLine1 is missing', () => {
      const { error } = invoicingSchema.validate({
        ...validPayload,
        invoiceAddress: { ...validUkInvoiceAddress, addressLine1: undefined }
      })
      expect(error.message).toContain('ADDRESS_LINE_1_REQUIRED')
    })

    test('should error when addressTown is missing', () => {
      const { error } = invoicingSchema.validate({
        ...validPayload,
        invoiceAddress: { ...validUkInvoiceAddress, addressTown: undefined }
      })
      expect(error.message).toContain('ADDRESS_TOWN_REQUIRED')
    })

    test('should error when addressPostcode is missing', () => {
      const { error } = invoicingSchema.validate({
        ...validPayload,
        invoiceAddress: {
          ...validUkInvoiceAddress,
          addressPostcode: undefined
        }
      })
      expect(error.message).toContain('ADDRESS_POSTCODE_REQUIRED')
    })

    test('should pass when optional fields are omitted', () => {
      const { error } = invoicingSchema.validate({
        ...validPayload,
        invoiceAddress: validUkInvoiceAddress
      })
      expect(error).toBeUndefined()
    })

    test('should pass when optional fields are provided', () => {
      const { error } = invoicingSchema.validate({
        ...validPayload,
        invoiceAddress: {
          ...validUkInvoiceAddress,
          addressLine2: 'Flat 2',
          addressCounty: 'Test'
        }
      })
      expect(error).toBeUndefined()
    })
  })

  describe('international', () => {
    test('should pass when invoiceAddress is not provided', () => {
      const { error } = invoicingSchema.validate({
        ...validPayload,
        invoiceAddressType: 'international',
        invoiceAddress: undefined
      })
      expect(error).toBeUndefined()
    })

    test('should pass when invoiceAddress is any object', () => {
      const { error } = invoicingSchema.validate({
        ...validPayload,
        invoiceAddressType: 'international',
        invoiceAddress: { anything: 'goes', for: 'now' }
      })
      expect(error).toBeUndefined()
    })
  })
})
