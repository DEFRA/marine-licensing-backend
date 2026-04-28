import joi from 'joi'

export const ACTIVITY_MIN_LENGTH = 1
export const ACTIVITY_DESCRIPTION_MAX_LENGTH = 1000

export const activityDescriptionSchema = joi
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
  })
