import joi from 'joi'
import { marineLicenceId } from '../shared-models.js'
import { ukInvoiceAddressSchema } from './uk-invoice-address.js'

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
      }),
    invoiceAddress: joi.when('invoiceAddressType', {
      is: 'uk',
      then: ukInvoiceAddressSchema.required(),
      otherwise: joi.object().unknown(true).optional()
    })
  })
  .append(marineLicenceId)
