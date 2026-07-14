import { invoicingSchema } from './invoicing.js'
import { mockMarineLicence } from './test-fixtures.js'

describe('invoicingSchema', () => {
  const validPayload = {
    invoiceAddressType: 'uk',
    id: mockMarineLicence._id.toHexString()
  }

  test('should pass with valid data', () => {
    const { error } = invoicingSchema.validate(validPayload)
    expect(error).toBeUndefined()
  })

  test('should pass when invoiceAddressType is international', () => {
    const { error } = invoicingSchema.validate({
      ...validPayload,
      invoiceAddressType: 'international'
    })
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
      invoiceAddressType: 'uk'
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
})
