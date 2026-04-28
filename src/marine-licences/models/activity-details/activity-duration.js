import joi from 'joi'

const MAX_MONTHS = 11

export const activityDurationSchema = joi
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
      .max(MAX_MONTHS)
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
  })
