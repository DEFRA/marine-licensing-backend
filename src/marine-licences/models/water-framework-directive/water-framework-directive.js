import joi from 'joi'
import { marineLicenceId } from '../shared-models.js'
import { fileUploadValidationSchema } from './file-upload.js'

const waterFrameworkDirectiveDetails = {
  assessmentChanged: joi.when('nauticalMile', {
    is: 'yes',
    then: joi.when('excludedActivities', {
      is: 'yes',
      then: joi.forbidden().messages({
        'any.unknown': 'WATER_FRAMEWORK_DIRECTIVE_INVALID'
      }),
      otherwise: joi.when('previousAssessment', {
        is: 'no',
        then: joi.string().valid('yes', 'no').allow(null).messages({
          'any.only': 'ASSESSMENT_CHANGED_REQUIRED'
        }),
        otherwise: joi.string().valid('yes', 'no').required().messages({
          'string.empty': 'ASSESSMENT_CHANGED_REQUIRED',
          'any.only': 'ASSESSMENT_CHANGED_REQUIRED',
          'any.required': 'ASSESSMENT_CHANGED_REQUIRED'
        })
      })
    }),
    otherwise: joi.forbidden().messages({
      'any.unknown': 'WATER_FRAMEWORK_DIRECTIVE_INVALID'
    })
  }),
  excludedActivities: joi.when('nauticalMile', {
    is: 'yes',
    then: joi.string().valid('yes', 'no').required().messages({
      'string.empty': 'EXCLUDED_ACTIVITIES_REQUIRED',
      'any.only': 'EXCLUDED_ACTIVITIES_REQUIRED',
      'any.required': 'EXCLUDED_ACTIVITIES_REQUIRED'
    }),
    otherwise: joi.forbidden().messages({
      'any.unknown': 'WATER_FRAMEWORK_DIRECTIVE_INVALID'
    })
  }),
  previousAssessment: joi.when('nauticalMile', {
    is: 'yes',
    then: joi.when('excludedActivities', {
      is: 'yes',
      then: joi.forbidden().messages({
        'any.unknown': 'WATER_FRAMEWORK_DIRECTIVE_INVALID'
      }),
      otherwise: joi.string().valid('yes', 'no').required().messages({
        'string.empty': 'PREVIOUS_ASSESSMENT_REQUIRED',
        'any.only': 'PREVIOUS_ASSESSMENT_REQUIRED',
        'any.required': 'PREVIOUS_ASSESSMENT_REQUIRED'
      })
    }),
    otherwise: joi.forbidden().messages({
      'any.unknown': 'WATER_FRAMEWORK_DIRECTIVE_INVALID'
    })
  }),
  ...fileUploadValidationSchema
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
