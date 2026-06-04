import joi from 'joi'
import { marineLicenceId } from '../shared-models.js'

const waterFrameworkDirectiveDetails = {
  excludedActivities: joi.when('nauticalMile', {
    is: 'yes',
    then: joi.string().valid('yes', 'no').required().messages({
      'string.empty': 'EXCLUDED_ACTIVITIES_REQUIRED',
      'any.only': 'EXCLUDED_ACTIVITIES_REQUIRED',
      'any.required': 'EXCLUDED_ACTIVITIES_REQUIRED'
    }),
    otherwise: joi.forbidden()
  })
}

export const waterFrameworkDirectiveSchema = joi
  .object({
    waterFrameworkDirective: joi
      .object({
        nauticalMile: joi.string().valid('yes', 'no').required().messages({
          'string.empty': 'NAUTICAL_MILE_REQUIRED',
          'any.only': 'NAUTICAL_MILE_REQUIRED',
          'any.required': 'NAUTICAL_MILE_REQUIRED'
        }),
        ...waterFrameworkDirectiveDetails
      })
      .required()
      .messages({
        'any.required': 'WATER_FRAMEWORK_DIRECTIVE_REQUIRED'
      })
  })
  .append(marineLicenceId)
