import joi from 'joi'

export const ACTIVITY_MIN_LENGTH = 1
export const WORKING_HOURS_MAX_LENGTH = 1_000

export const workingHoursSchema = joi
  .string()
  .optional()
  .allow('')
  .trim()
  .min(1)
  .max(WORKING_HOURS_MAX_LENGTH)
  .messages({
    'string.empty': 'WORKING_HOURS_REQUIRED',
    'string.base': 'WORKING_HOURS_REQUIRED',
    'any.required': 'WORKING_HOURS_REQUIRED',
    'string.max': 'WORKING_HOURS_MAX_LENGTH'
  })
