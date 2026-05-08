import joi from 'joi'

export const circleWidthValidationSchema = joi
  .string()
  .required()
  .custom((value, helpers) => {
    const width = Number(value)

    if (Number.isNaN(width)) {
      return helpers.error('number.base')
    }

    if (width <= 0) {
      return helpers.error('number.min')
    }

    if (!Number.isInteger(width)) {
      return helpers.error('number.integer')
    }

    return value
  })
  .messages({
    'string.empty': 'WIDTH_REQUIRED',
    'string.base': 'WIDTH_REQUIRED',
    'any.required': 'WIDTH_REQUIRED',
    'number.base': 'WIDTH_INVALID',
    'number.min': 'WIDTH_MIN',
    'number.integer': 'WIDTH_NON_INTEGER'
  })
