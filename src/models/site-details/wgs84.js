import joi from 'joi'
import {
  LAT_LONG_DECIMAL_PLACES,
  MAX_LATITUDE,
  MAX_LONGITUDE,
  MIN_LATITUDE,
  MIN_LONGITUDE
} from '../../common/constants/coordinates.js'

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
