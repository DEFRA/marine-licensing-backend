import joi from 'joi'

export const siteNameFieldSchema = joi
  .string()
  .min(1)
  .max(250)
  .required()
  .messages({
    'string.empty': 'SITE_NAME_REQUIRED',
    'any.required': 'SITE_NAME_REQUIRED',
    'string.max': 'SITE_NAME_MAX_LENGTH'
  })
