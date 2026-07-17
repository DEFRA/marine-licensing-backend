import { invoicingSchema } from './invoicing.js'
import { mockMarineLicence } from '../test-fixtures.js'

describe('invoicingSchema', () => {
  const validUkInvoiceAddress = {
    addressLine1: '1 Test Street',
    addressTown: 'Test town',
    addressPostcode: 'TE1 1ST'
  }

  const validInvoiceContactDetails = {
    fullName: 'Test Person',
    organisationName: 'Test Organisation',
    phoneNumber: '01234 567890',
    emailAddress: 'test@example.com'
  }

  const validPayload = {
    invoiceAddressType: 'uk',
    invoiceAddress: validUkInvoiceAddress,
    invoiceContactDetails: validInvoiceContactDetails,
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
      invoiceAddress: validUkInvoiceAddress,
      invoiceContactDetails: validInvoiceContactDetails
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

  describe('invoiceContactDetails', () => {
    test('should error when invoiceContactDetails is missing', () => {
      const { error } = invoicingSchema.validate({
        ...validPayload,
        invoiceContactDetails: undefined
      })
      expect(error.message).toContain('INVOICING_CONTACT_DETAILS_REQUIRED')
    })

    test('should error when fullName is missing', () => {
      const { error } = invoicingSchema.validate({
        ...validPayload,
        invoiceContactDetails: {
          ...validInvoiceContactDetails,
          fullName: undefined
        }
      })
      expect(error.message).toContain('INVOICING_CONTACT_FULL_NAME_REQUIRED')
    })

    test('should error when organisationName is missing', () => {
      const { error } = invoicingSchema.validate({
        ...validPayload,
        invoiceContactDetails: {
          ...validInvoiceContactDetails,
          organisationName: undefined
        }
      })
      expect(error.message).toContain(
        'INVOICING_CONTACT_ORGANISATION_NAME_REQUIRED'
      )
    })

    test('should error when phoneNumber is missing', () => {
      const { error } = invoicingSchema.validate({
        ...validPayload,
        invoiceContactDetails: {
          ...validInvoiceContactDetails,
          phoneNumber: undefined
        }
      })
      expect(error.message).toContain(
        'INVOICING_CONTACT_PHONE_NUMBER_REQUIRED'
      )
    })

    test('should error when emailAddress is invalid', () => {
      const { error } = invoicingSchema.validate({
        ...validPayload,
        invoiceContactDetails: {
          ...validInvoiceContactDetails,
          emailAddress: 'not-an-email'
        }
      })
      expect(error.message).toContain(
        'INVOICING_CONTACT_EMAIL_ADDRESS_INVALID'
      )
    })
  })

  describe('international', () => {
    const validInternationalInvoiceAddress = {
      country: 'France',
      address: '1 Rue de Test'
    }

    test('should pass with valid data', () => {
      const { error } = invoicingSchema.validate({
        ...validPayload,
        invoiceAddressType: 'international',
        invoiceAddress: validInternationalInvoiceAddress
      })
      expect(error).toBeUndefined()
    })

    test('should error when invoiceAddress is missing', () => {
      const { error } = invoicingSchema.validate({
        ...validPayload,
        invoiceAddressType: 'international',
        invoiceAddress: undefined
      })
      expect(error.message).toContain('"invoiceAddress" is required')
    })

    test('should error when country is missing', () => {
      const { error } = invoicingSchema.validate({
        ...validPayload,
        invoiceAddressType: 'international',
        invoiceAddress: {
          ...validInternationalInvoiceAddress,
          country: undefined
        }
      })
      expect(error.message).toContain('INVOICING_COUNTRY_REQUIRED')
    })

    test('should error when address is missing', () => {
      const { error } = invoicingSchema.validate({
        ...validPayload,
        invoiceAddressType: 'international',
        invoiceAddress: {
          ...validInternationalInvoiceAddress,
          address: undefined
        }
      })
      expect(error.message).toContain('INVOICING_ADDRESS_REQUIRED')
    })

    test('should error when address is too long', () => {
      const { error } = invoicingSchema.validate({
        ...validPayload,
        invoiceAddressType: 'international',
        invoiceAddress: {
          ...validInternationalInvoiceAddress,
          address: 'a'.repeat(301)
        }
      })
      expect(error.message).toContain('INVOICING_ADDRESS_MAX_LENGTH')
    })
  })
})
