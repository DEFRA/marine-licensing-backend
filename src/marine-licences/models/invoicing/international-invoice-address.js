import joi from 'joi'

const ADDRESS_MAX_LENGTH = 300

export const internationalInvoiceAddressSchema = joi.object({
  country: joi.string().trim().required().messages({
    'string.empty': 'INVOICING_COUNTRY_REQUIRED',
    'any.required': 'INVOICING_COUNTRY_REQUIRED'
  }),
  address: joi.string().trim().max(ADDRESS_MAX_LENGTH).required().messages({
    'string.empty': 'INVOICING_ADDRESS_REQUIRED',
    'any.required': 'INVOICING_ADDRESS_REQUIRED',
    'string.max': 'INVOICING_ADDRESS_MAX_LENGTH'
  })
})
