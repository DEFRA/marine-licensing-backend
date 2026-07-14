import joi from 'joi'
import { UK_POSTCODE_PATTERN } from '../../constants/address'

const ADDRESS_LINE_MAX_LENGTH = 100
const ADDRESS_TOWN_MAX_LENGTH = 30
const ADDRESS_COUNTY_MAX_LENGTH = 50

export const ukInvoiceAddressSchema = joi.object({
  addressLine1: joi
    .string()
    .trim()
    .max(ADDRESS_LINE_MAX_LENGTH)
    .required()
    .messages({
      'string.empty': 'ADDRESS_LINE_1_REQUIRED',
      'any.required': 'ADDRESS_LINE_1_REQUIRED',
      'string.max': 'ADDRESS_LINE_1_MAX_LENGTH'
    }),
  addressLine2: joi
    .string()
    .trim()
    .max(ADDRESS_LINE_MAX_LENGTH)
    .allow('')
    .optional()
    .messages({
      'string.max': 'ADDRESS_LINE_2_MAX_LENGTH'
    }),
  addressTown: joi
    .string()
    .trim()
    .max(ADDRESS_TOWN_MAX_LENGTH)
    .required()
    .messages({
      'string.empty': 'ADDRESS_TOWN_REQUIRED',
      'any.required': 'ADDRESS_TOWN_REQUIRED',
      'string.max': 'ADDRESS_TOWN_MAX_LENGTH'
    }),
  addressCounty: joi
    .string()
    .trim()
    .max(ADDRESS_COUNTY_MAX_LENGTH)
    .allow('')
    .optional()
    .messages({
      'string.max': 'ADDRESS_COUNTY_MAX_LENGTH'
    }),
  addressPostcode: joi
    .string()
    .trim()
    .pattern(UK_POSTCODE_PATTERN)
    .required()
    .messages({
      'string.empty': 'ADDRESS_POSTCODE_REQUIRED',
      'any.required': 'ADDRESS_POSTCODE_REQUIRED',
      'string.pattern.base': 'ADDRESS_POSTCODE_INVALID'
    })
})
