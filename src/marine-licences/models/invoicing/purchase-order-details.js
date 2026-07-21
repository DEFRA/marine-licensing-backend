import joi from 'joi'

const PURCHASE_ORDER_NUMBER_MAX_LENGTH = 30

export const purchaseOrderDetailsSchema = joi.object({
  requiresPurchaseOrder: joi.string().valid('yes', 'no').required().messages({
    'any.only': 'INVOICING_PURCHASE_ORDER_REQUIRED',
    'string.empty': 'INVOICING_PURCHASE_ORDER_REQUIRED',
    'any.required': 'INVOICING_PURCHASE_ORDER_REQUIRED'
  }),
  purchaseOrderNumber: joi.when('requiresPurchaseOrder', {
    is: 'yes',
    then: joi
      .string()
      .trim()
      .max(PURCHASE_ORDER_NUMBER_MAX_LENGTH)
      .required()
      .messages({
        'string.empty': 'INVOICING_PURCHASE_ORDER_NUMBER_REQUIRED',
        'any.required': 'INVOICING_PURCHASE_ORDER_NUMBER_REQUIRED',
        'string.max': 'INVOICING_PURCHASE_ORDER_NUMBER_MAX_LENGTH'
      })
  })
})
