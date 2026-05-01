import joi from 'joi'

export const WORKING_HOURS_MAX_LENGTH = 1_000

export const workingHoursSchema = joi
  .string()
  .optional()
  .allow('')
  .trim()
  .max(WORKING_HOURS_MAX_LENGTH)
  .messages({
    'string.empty': 'WORKING_HOURS_REQUIRED',
    'string.base': 'WORKING_HOURS_REQUIRED',
    'any.required': 'WORKING_HOURS_REQUIRED',
    'string.max': 'WORKING_HOURS_MAX_LENGTH'
  })
