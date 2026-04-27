import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

const activityTypeValues = ['construction', 'deposit', 'removal']

export const ACTIVITY_MIN_LENGTH = 1
export const ACTIVITY_DESCRIPTION_MAX_LENGTH = 1000

export const activityItemSchema = joi.object({
  activityType: joi
    .string()
    .valid(...activityTypeValues)
    .optional()
    .allow('')
    .messages({
      'any.only': 'ACTIVITY_TYPE_REQUIRED',
      'string.empty': 'ACTIVITY_TYPE_REQUIRED',
      'any.required': 'ACTIVITY_TYPE_REQUIRED'
    }),
  activitySubType: joi.when('activityType', {
    is: joi
      .string()
      .valid(...activityTypeValues)
      .required(),
    then: joi.string().required().messages({
      'string.empty': 'ACTIVITY_SUBTYPE_REQUIRED',
      'any.required': 'ACTIVITY_SUBTYPE_REQUIRED'
    }),
    otherwise: joi.string().optional().allow('').max(0).messages({
      'string.max': 'ACTIVITY_TYPE_REQUIRED'
    })
  }),
  activities: joi.when('activitySubType', {
    is: joi.string().min(1).required(),
    then: joi
      .object({
        selections: joi
          .array()
          .items(joi.string())
          .single()
          .min(1)
          .required()
          .messages({
            'array.min': 'ACTIVITIES_REQUIRED',
            'any.required': 'ACTIVITIES_REQUIRED'
          }),
        otherActivity: joi.when('selections', {
          is: joi.array().has(joi.string().valid('other')),
          then: joi.string().trim().max(1000).required().messages({
            'string.empty': 'ACTIVITIES_OTHER_REASON_REQUIRED',
            'any.required': 'ACTIVITIES_OTHER_REASON_REQUIRED',
            'string.max': 'ACTIVITIES_OTHER_REASON_MAX_LENGTH'
          }),
          otherwise: joi.optional()
        })
      })
      .required()
      .messages({
        'any.required': 'ACTIVITIES_REQUIRED'
      }),
    otherwise: joi.optional()
  }),
  activityDescription: joi
    .string()
    .optional()
    .allow('')
    .trim()
    .min(ACTIVITY_MIN_LENGTH)
    .max(ACTIVITY_DESCRIPTION_MAX_LENGTH)
    .messages({
      'string.empty': 'ACTIVITY_DESCRIPTION_REQUIRED',
      'string.base': 'ACTIVITY_DESCRIPTION_REQUIRED',
      'any.required': 'ACTIVITY_DESCRIPTION_REQUIRED',
      'string.max': 'ACTIVITY_DESCRIPTION_MAX_LENGTH'
    }),
  activityDuration: joi
    .object({
      years: joi.number().integer().min(0).messages({
        'any.required': 'YEARS_REQUIRED',
        'number.base': 'YEARS_NOT_INTEGER',
        'number.integer': 'YEARS_NOT_INTEGER',
        'number.min': 'YEARS_NOT_INTEGER'
      }),
      months: joi
        .number()
        .integer()
        .min(0)
        .max(11)
        .messages({
          'any.required': 'MONTHS_REQUIRED',
          'number.base': 'MONTHS_NOT_VALID',
          'number.integer': 'MONTHS_NOT_VALID',
          'number.min': 'MONTHS_NOT_VALID',
          'number.max': 'MONTHS_NOT_VALID'
        })
        .when('years', {
          is: 0,
          then: joi.invalid(0).messages({
            'any.invalid': 'DURATION_BOTH_ZERO'
          })
        })
        .when('years', { is: joi.exist(), then: joi.required() })
    })
    .when(joi.object({ months: joi.exist() }).unknown(), {
      then: joi.object({ years: joi.required() })
    }),
  completionDate: joi.string().optional().allow(''),
  activityMonths: joi.string().optional().allow(''),
  workingHours: joi.string().optional().allow('')
})

export const activityDetailsSchema = joi
  .object({
    siteIndex: joi.number().integer().min(0).required().messages({
      'number.base': 'SITE_INDEX_REQUIRED',
      'number.integer': 'SITE_INDEX_INVALID',
      'number.min': 'SITE_INDEX_INVALID',
      'any.required': 'SITE_INDEX_REQUIRED'
    })
  })
  .append(marineLicenceId)
