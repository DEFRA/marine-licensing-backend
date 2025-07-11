import joi from 'joi'
import {
  MIN_EASTINGS_LENGTH,
  MAX_EASTINGS_LENGTH,
  MIN_NORTHINGS_LENGTH,
  MAX_NORTHINGS_LENGTH
} from '../../common/constants/coordinates.js'

const validateCoordinates = (value, helpers, type) => {
  const coordinate = Number(value)
  if (isNaN(coordinate)) {
    return helpers.error('number.base')
  }

  if (coordinate <= 0) {
    return helpers.error('number.positive')
  }

  if (
    type === 'eastings' &&
    (coordinate < MIN_EASTINGS_LENGTH || coordinate > MAX_EASTINGS_LENGTH)
  ) {
    return helpers.error('number.range')
  }

  if (
    type === 'northings' &&
    (coordinate < MIN_NORTHINGS_LENGTH || coordinate > MAX_NORTHINGS_LENGTH)
  ) {
    return helpers.error('number.range')
  }

  return value
}

export const osgb36ValidationSchema = joi.object({
  eastings: joi
    .string()
    .required()
    .pattern(/^-?[0-9.]+$/)
    .custom((value, helpers) => validateCoordinates(value, helpers, 'eastings'))
    .messages({
      'string.empty': 'EASTINGS_REQUIRED',
      'string.pattern.base': 'EASTINGS_NON_NUMERIC',
      'number.base': 'EASTINGS_NON_NUMERIC',
      'number.positive': 'EASTINGS_POSITIVE_NUMBER',
      'number.range': 'EASTINGS_LENGTH',
      'any.required': 'EASTINGS_REQUIRED'
    }),
  northings: joi
    .string()
    .required()
    .pattern(/^-?[0-9.]+$/)
    .custom((value, helpers) =>
      validateCoordinates(value, helpers, 'northings')
    )
    .messages({
      'string.empty': 'NORTHINGS_REQUIRED',
      'string.pattern.base': 'NORTHINGS_NON_NUMERIC',
      'number.base': 'NORTHINGS_NON_NUMERIC',
      'number.positive': 'NORTHINGS_POSITIVE_NUMBER',
      'number.range': 'NORTHINGS_LENGTH',
      'any.required': 'NORTHINGS_REQUIRED'
    })
})
