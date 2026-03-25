import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

const SPECIAL_LEGAL_POWERS_DETAILS_MAX_TEXT_LENGTH = 1000

export const specialLegalPowers = joi
  .object({
    agree: joi.string().valid('yes', 'no').required().messages({
      'string.required': 'SPECIAL_LEGAL_POWERS_AGREE_REQUIRED',
      'any.only': 'SPECIAL_LEGAL_POWERS_AGREE_REQUIRED',
      'any.required': 'SPECIAL_LEGAL_POWERS_AGREE_REQUIRED'
    }),
    // agree: 'yes' = user agrees organisation has special powers (details required)
    // agree: 'no' = user says organisation does not have special powers (no details required)
    details: joi.when('agree', {
      is: 'yes',
      then: joi
        .string()
        .required()
        .min(1)
        .max(SPECIAL_LEGAL_POWERS_DETAILS_MAX_TEXT_LENGTH)
        .messages({
          'string.empty': 'SPECIAL_LEGAL_POWERS_DETAILS_REQUIRED',
          'string.max': 'SPECIAL_LEGAL_POWERS_DETAILS_MAX_LENGTH',
          'any.required': 'SPECIAL_LEGAL_POWERS_DETAILS_REQUIRED'
        }),
      otherwise: joi.forbidden()
    })
  })
  .append(marineLicenceId)
