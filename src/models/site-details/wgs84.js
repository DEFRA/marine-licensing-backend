import joi from 'joi'
import { MIN_POINTS_MULTIPLE_COORDINATES } from '../../common/constants/coordinates.js'

const MIN_LATITUDE = -90
const MAX_LATITUDE = 90
const MIN_LONGITUDE = -180
const MAX_LONGITUDE = 180
const LAT_LONG_DECIMAL_PLACES = 6

const validateDecimals = (value, helpers) => {
  const decimalParts = value.split('.')
  if (
    decimalParts.length !== 2 ||
    decimalParts[1].length !== LAT_LONG_DECIMAL_PLACES
  ) {
    return helpers.error('number.decimal')
  }

  return value
}

const validateCoordinates = (value, helpers, type) => {
  const coordinate = Number(value)
  if (isNaN(coordinate)) {
    return helpers.error('number.base')
  }

  if (
    type === 'latitude' &&
    (coordinate < MIN_LATITUDE || coordinate > MAX_LATITUDE)
  ) {
    return helpers.error('number.range')
  }

  if (
    type === 'longitude' &&
    (coordinate < MIN_LONGITUDE || coordinate > MAX_LONGITUDE)
  ) {
    return helpers.error('number.range')
  }

  return value
}

// Single coordinate validation schema
export const wgs84ValidationSchema = joi.object({
  latitude: joi
    .string()
    .required()
    .pattern(/^-?[0-9.]+$/)
    .custom((value, helpers) => validateCoordinates(value, helpers, 'latitude'))
    .custom((value, helpers) => validateDecimals(value, helpers))
    .messages({
      'string.empty': 'LATITUDE_REQUIRED',
      'any.required': 'LATITUDE_REQUIRED',
      'string.pattern.base': 'LATITUDE_NON_NUMERIC',
      'number.base': 'LATITUDE_NON_NUMERIC',
      'number.range': 'LATITUDE_LENGTH',
      'number.decimal': 'LATITUDE_DECIMAL_PLACES'
    }),
  longitude: joi
    .string()
    .required()
    .pattern(/^-?[0-9.]+$/)
    .custom((value, helpers) =>
      validateCoordinates(value, helpers, 'longitude')
    )
    .custom((value, helpers) => validateDecimals(value, helpers))
    .messages({
      'string.empty': 'LONGITUDE_REQUIRED',
      'any.required': 'LONGITUDE_REQUIRED',
      'string.pattern.base': 'LONGITUDE_NON_NUMERIC',
      'number.base': 'LONGITUDE_NON_NUMERIC',
      'number.range': 'LONGITUDE_LENGTH',
      'number.decimal': 'LONGITUDE_DECIMAL_PLACES'
    })
})

// Multiple coordinates validation schema (array of coordinate objects)
export const wgs84MultipleValidationSchema = joi
  .array()
  .items(wgs84ValidationSchema)
  .min(MIN_POINTS_MULTIPLE_COORDINATES)
  .max(1000)
  .required()
  .messages({
    'array.min': 'COORDINATES_MINIMUM_REQUIRED',
    'array.max': 'COORDINATES_MAXIMUM_EXCEEDED',
    'array.base': 'COORDINATES_ARRAY_REQUIRED',
    'any.required': 'COORDINATES_REQUIRED'
  })
