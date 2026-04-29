import joi from 'joi'

export const MONTHS_OF_ACTIVITY_DETAILS_MAX_LENGTH = 1000

export const activityMonthsSchema = joi.object({
  months: joi.string().valid('yes', 'no').optional().messages({
    'any.only': 'MONTHS_OF_ACTIVITY_REQUIRED',
    'string.empty': 'MONTHS_OF_ACTIVITY_REQUIRED',
    'any.required': 'MONTHS_OF_ACTIVITY_REQUIRED'
  }),
  details: joi.when('months', {
    is: 'yes',
    then: joi
      .string()
      .trim()
      .max(MONTHS_OF_ACTIVITY_DETAILS_MAX_LENGTH)
      .required()
      .messages({
        'string.empty': 'MONTHS_OF_ACTIVITY_DETAILS_REQUIRED',
        'any.required': 'MONTHS_OF_ACTIVITY_DETAILS_REQUIRED',
        'string.max': 'MONTHS_OF_ACTIVITY_DETAILS_MAX_LENGTH'
      })
  })
})
