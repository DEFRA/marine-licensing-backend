import { purchaseOrderDetailsSchema } from './purchase-order-details.js'

describe('purchaseOrderDetailsSchema', () => {
  const validPayload = {
    requiresPurchaseOrder: 'yes',
    purchaseOrderNumber: 'PO-12345'
  }

  test('should pass with valid data when purchase order is required', () => {
    const { error } = purchaseOrderDetailsSchema.validate(validPayload)
    expect(error).toBeUndefined()
  })

  test('should pass when requiresPurchaseOrder is no and purchaseOrderNumber is omitted', () => {
    const { error } = purchaseOrderDetailsSchema.validate({
      requiresPurchaseOrder: 'no'
    })
    expect(error).toBeUndefined()
  })

  test('should error when requiresPurchaseOrder is missing', () => {
    const { error } = purchaseOrderDetailsSchema.validate({
      ...validPayload,
      requiresPurchaseOrder: undefined
    })
    expect(error.message).toContain('INVOICING_PURCHASE_ORDER_REQUIRED')
  })

  test('should error when requiresPurchaseOrder is not a valid option', () => {
    const { error } = purchaseOrderDetailsSchema.validate({
      ...validPayload,
      requiresPurchaseOrder: 'maybe'
    })
    expect(error.message).toContain('INVOICING_PURCHASE_ORDER_REQUIRED')
  })

  test('should error when purchaseOrderNumber is missing and requiresPurchaseOrder is yes', () => {
    const { error } = purchaseOrderDetailsSchema.validate({
      requiresPurchaseOrder: 'yes'
    })
    expect(error.message).toContain('INVOICING_PURCHASE_ORDER_NUMBER_REQUIRED')
  })

  test('should error when purchaseOrderNumber is too long', () => {
    const { error } = purchaseOrderDetailsSchema.validate({
      ...validPayload,
      purchaseOrderNumber: 'a'.repeat(31)
    })
    expect(error.message).toContain(
      'INVOICING_PURCHASE_ORDER_NUMBER_MAX_LENGTH'
    )
  })
})
