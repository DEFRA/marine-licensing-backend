import joi from 'joi'

export const COMPLETION_DATE_REASON_MAX_LENGTH = 1000

export const completionDateSchema = joi.object({
  date: joi.string().valid('yes', 'no').optional().messages({
    'any.only': 'COMPLETION_DATE_REQUIRED',
    'string.empty': 'COMPLETION_DATE_REQUIRED'
  }),
  reason: joi.when('date', {
    is: 'yes',
    then: joi
      .string()
      .trim()
      .min(1)
      .max(COMPLETION_DATE_REASON_MAX_LENGTH)
      .required()
      .messages({
        'string.empty': 'COMPLETION_DATE_REASON_REQUIRED',
        'any.required': 'COMPLETION_DATE_REASON_REQUIRED',
        'string.max': 'COMPLETION_DATE_REASON_MAX_LENGTH',
        'string.min': 'COMPLETION_DATE_REASON_REQUIRED'
      })
  })
})
