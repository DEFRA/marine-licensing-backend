import joi from 'joi'
import { marineLicenceId } from '../shared-models.js'
import { ukInvoiceAddressSchema } from './uk-invoice-address.js'
import { internationalInvoiceAddressSchema } from './international-invoice-address.js'
import { invoiceContactDetailsSchema } from './invoice-contact-details.js'
import { purchaseOrderDetailsSchema } from './purchase-order-details.js'

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
      otherwise: internationalInvoiceAddressSchema.required()
    }),
    invoiceContactDetails: invoiceContactDetailsSchema.required().messages({
      'any.required': 'INVOICING_CONTACT_DETAILS_REQUIRED'
    }),
    purchaseOrderDetails: purchaseOrderDetailsSchema.optional()
  })
  .append(marineLicenceId)
