import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

const OTHER_AUTHORITIES_DETAILS_MAX_TEXT_LENGTH = 1000

export const otherAuthorities = joi
  .object({
    agree: joi.string().valid('yes', 'no').required().messages({
      'string.required': 'OTHER_AUTHORITIES_AGREE_REQUIRED',
      'any.only': 'OTHER_AUTHORITIES_AGREE_REQUIRED',
      'any.required': 'OTHER_AUTHORITIES_AGREE_REQUIRED'
    }),
    details: joi.when('agree', {
      is: 'yes',
      then: joi
        .string()
        .required()
        .min(1)
        .max(OTHER_AUTHORITIES_DETAILS_MAX_TEXT_LENGTH)
        .messages({
          'string.empty': 'OTHER_AUTHORITIES_DETAILS_REQUIRED',
          'string.max': 'OTHER_AUTHORITIES_DETAILS_MAX_LENGTH',
          'any.required': 'OTHER_AUTHORITIES_DETAILS_REQUIRED'
        }),
      otherwise: joi.forbidden()
    })
  })
  .append(marineLicenceId)
