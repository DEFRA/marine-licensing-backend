import joi from 'joi'

const FULL_NAME_MAX_LENGTH = 100
const ORGANISATION_MAX_LENGTH = 100
const EMAIL_MAX_LENGTH = 254

export const invoiceContactDetailsSchema = joi.object({
  fullName: joi.string().trim().max(FULL_NAME_MAX_LENGTH).required().messages({
    'string.empty': 'INVOICING_CONTACT_FULL_NAME_REQUIRED',
    'any.required': 'INVOICING_CONTACT_FULL_NAME_REQUIRED',
    'string.max': 'INVOICING_CONTACT_FULL_NAME_MAX_LENGTH'
  }),
  organisationName: joi
    .string()
    .trim()
    .max(ORGANISATION_MAX_LENGTH)
    .required()
    .messages({
      'string.empty': 'INVOICING_CONTACT_ORGANISATION_NAME_REQUIRED',
      'any.required': 'INVOICING_CONTACT_ORGANISATION_NAME_REQUIRED',
      'string.max': 'INVOICING_CONTACT_ORGANISATION_NAME_MAX_LENGTH'
    }),
  phoneNumber: joi.string().trim().required().messages({
    'string.empty': 'INVOICING_CONTACT_PHONE_NUMBER_REQUIRED',
    'any.required': 'INVOICING_CONTACT_PHONE_NUMBER_REQUIRED'
  }),
  emailAddress: joi
    .string()
    .trim()
    .max(EMAIL_MAX_LENGTH)
    .email()
    .required()
    .messages({
      'string.empty': 'INVOICING_CONTACT_EMAIL_ADDRESS_REQUIRED',
      'any.required': 'INVOICING_CONTACT_EMAIL_ADDRESS_REQUIRED',
      'string.max': 'INVOICING_CONTACT_EMAIL_ADDRESS_MAX_LENGTH',
      'string.email': 'INVOICING_CONTACT_EMAIL_ADDRESS_INVALID'
    })
})
