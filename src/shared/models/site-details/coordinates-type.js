import joi from 'joi'

export const coordinatesTypeFieldSchema = joi
  .string()
  .valid('file', 'coordinates')
  .required()
  .messages({
    'any.only': 'PROVIDE_COORDINATES_CHOICE_REQUIRED',
    'string.empty': 'PROVIDE_COORDINATES_CHOICE_REQUIRED',
    'any.required': 'PROVIDE_COORDINATES_CHOICE_REQUIRED'
  })
