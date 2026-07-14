import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

export const invoicingSchema = joi
  .object({
    invoiceAddressType: joi
      .string()
      .valid('uk', 'international')
      .required()
      .messages({
        'string.empty': 'INVOICE_ADDRESS_TYPE_REQUIRED',
        'any.only': 'INVOICE_ADDRESS_TYPE_REQUIRED',
        'any.required': 'INVOICE_ADDRESS_TYPE_REQUIRED'
      })
  })
  .append(marineLicenceId)
