import joi from 'joi'
import { MIN_POINTS_MULTIPLE_COORDINATES } from '../../common/constants/coordinates.js'

const MIN_EASTINGS_LENGTH = 0
const MAX_EASTINGS_LENGTH = 999999
const MIN_NORTHINGS_LENGTH = 0
const MAX_NORTHINGS_LENGTH = 9999999

const validateCoordinates = (value, helpers, type) => {
  const coordinate = Number(value)
  if (Number.isNaN(coordinate)) {
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

// Single coordinate validation schema
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

// Multiple coordinates validation schema (array of coordinate objects)
export const osgb36MultipleValidationSchema = joi
  .array()
  .items(osgb36ValidationSchema)
  .min(MIN_POINTS_MULTIPLE_COORDINATES)
  .max(1000)
  .required()
  .messages({
    'array.min': 'COORDINATES_MINIMUM_REQUIRED',
    'array.max': 'COORDINATES_MAXIMUM_EXCEEDED',
    'array.base': 'COORDINATES_ARRAY_REQUIRED',
    'any.required': 'COORDINATES_REQUIRED'
  })
