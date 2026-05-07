import joi from 'joi'
import { MIN_POINTS_MULTIPLE_COORDINATES } from '../../../shared/common/constants/coordinates.js'

const MIN_EASTING = 0
const MAX_EASTING = 999999
const MIN_NORTHING = 0
const MAX_NORTHING = 9999999

const validateCoordinate = (value, helpers, type) => {
  const coordinate = Number(value)

  if (Number.isNaN(coordinate)) {
    return helpers.error('number.base')
  }

  if (coordinate < 0) {
    return helpers.error('number.positive')
  }

  if (
    type === 'easting' &&
    (coordinate < MIN_EASTING || coordinate > MAX_EASTING)
  ) {
    return helpers.error('number.range')
  }

  if (
    type === 'northing' &&
    (coordinate < MIN_NORTHING || coordinate > MAX_NORTHING)
  ) {
    return helpers.error('number.range')
  }

  return value
}

export const osgb36MultipleItemSchema = joi.object({
  easting: joi
    .string()
    .required()
    .pattern(/^-?[0-9.]+$/)
    .custom((value, helpers) => validateCoordinate(value, helpers, 'easting'))
    .messages({
      'string.empty': 'EASTING_REQUIRED',
      'any.required': 'EASTING_REQUIRED',
      'string.pattern.base': 'EASTING_NON_NUMERIC',
      'number.base': 'EASTING_NON_NUMERIC',
      'number.positive': 'EASTING_POSITIVE_NUMBER',
      'number.range': 'EASTING_LENGTH'
    }),
  northing: joi
    .string()
    .required()
    .pattern(/^-?[0-9.]+$/)
    .custom((value, helpers) => validateCoordinate(value, helpers, 'northing'))
    .messages({
      'string.empty': 'NORTHING_REQUIRED',
      'any.required': 'NORTHING_REQUIRED',
      'string.pattern.base': 'NORTHING_NON_NUMERIC',
      'number.base': 'NORTHING_NON_NUMERIC',
      'number.positive': 'NORTHING_POSITIVE_NUMBER',
      'number.range': 'NORTHING_LENGTH'
    })
})

export const osgb36MultipleCoordinatesSchema = joi
  .array()
  .items(osgb36MultipleItemSchema)
  .min(MIN_POINTS_MULTIPLE_COORDINATES)
  .max(1000)
  .required()
  .messages({
    'array.min': 'COORDINATES_MINIMUM_REQUIRED',
    'array.max': 'COORDINATES_MAXIMUM_EXCEEDED',
    'array.base': 'COORDINATES_ARRAY_REQUIRED',
    'any.required': 'COORDINATES_REQUIRED'
  })
