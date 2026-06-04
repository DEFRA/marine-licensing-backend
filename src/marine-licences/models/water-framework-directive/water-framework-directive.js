import joi from 'joi'
import { marineLicenceId } from '../shared-models.js'

export const waterFrameworkDirectiveSchema = joi
  .object({
    waterFrameworkDirective: joi
      .object({
        nauticalMile: joi.string().valid('yes', 'no').required().messages({
          'string.empty': 'NAUTICAL_MILE_REQUIRED',
          'any.only': 'NAUTICAL_MILE_REQUIRED',
          'any.required': 'NAUTICAL_MILE_REQUIRED'
        })
      })
      .required()
      .messages({
        'any.required': 'WATER_FRAMEWORK_DIRECTIVE_REQUIRED'
      })
  })
  .append(marineLicenceId)
