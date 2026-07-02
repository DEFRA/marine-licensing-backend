import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

const HARBOUR_AUTHORITY_DETAILS_MAX_TEXT_LENGTH = 1000

export const harbourAuthoritySchema = joi
  .object({
    harbourArea: joi.string().valid('yes', 'no').required().messages({
      'string.empty': 'HARBOUR_AUTHORITY_REQUIRED',
      'any.only': 'HARBOUR_AUTHORITY_REQUIRED',
      'any.required': 'HARBOUR_AUTHORITY_REQUIRED'
    }),
    details: joi.when('harbourArea', {
      is: 'yes',
      then: joi
        .string()
        .trim()
        .required()
        .min(1)
        .max(HARBOUR_AUTHORITY_DETAILS_MAX_TEXT_LENGTH)
        .messages({
          'string.empty': 'HARBOUR_AUTHORITY_DETAILS_REQUIRED',
          'string.max': 'HARBOUR_AUTHORITY_DETAILS_MAX_LENGTH',
          'any.required': 'HARBOUR_AUTHORITY_DETAILS_REQUIRED'
        }),
      otherwise: joi.forbidden().messages({
        'any.unknown': 'HARBOUR_AUTHORITY_DETAILS_NOT_ALLOWED'
      })
    })
  })
  .append(marineLicenceId)
