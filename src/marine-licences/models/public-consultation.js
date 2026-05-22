import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

const PUBLIC_CONSULTATION_DETAILS_MAX_TEXT_LENGTH = 1000

export const publicConsultation = joi
  .object({
    consulted: joi.string().valid('yes', 'no').required().messages({
      'string.empty': 'PUBLIC_CONSULTATION_REQUIRED',
      'any.only': 'PUBLIC_CONSULTATION_REQUIRED',
      'any.required': 'PUBLIC_CONSULTATION_REQUIRED'
    }),
    details: joi.when('consulted', {
      is: 'yes',
      then: joi
        .string()
        .trim()
        .required()
        .min(1)
        .max(PUBLIC_CONSULTATION_DETAILS_MAX_TEXT_LENGTH)
        .messages({
          'string.empty': 'PUBLIC_CONSULTATION_DETAILS_REQUIRED',
          'string.max': 'PUBLIC_CONSULTATION_DETAILS_MAX_LENGTH',
          'any.required': 'PUBLIC_CONSULTATION_DETAILS_REQUIRED'
        }),
      otherwise: joi.forbidden()
    })
  })
  .append(marineLicenceId)
