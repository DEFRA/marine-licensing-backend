import joi from 'joi'
import { exemptionId } from '../shared-models.js'
import {
  COORDINATE_SYSTEMS,
  MIN_LATITUDE,
  MAX_LATITUDE,
  MIN_LONGITUDE,
  MAX_LONGITUDE,
  MIN_EASTINGS_LENGTH,
  MAX_EASTINGS_LENGTH,
  MIN_NORTHINGS_LENGTH,
  MAX_NORTHINGS_LENGTH
} from '../../common/constants/coordinates.js'

const NUMBER_RANGE_ERROR = 'number.range'

const wgs84CoordinateSchema = joi.object({
  latitude: joi
    .string()
    .required()
    .pattern(/^-?\d+\.\d{6}$/)
    .custom((value, helpers) => {
      const latitude = parseFloat(value)
      if (latitude < MIN_LATITUDE || latitude > MAX_LATITUDE) {
        return helpers.error(NUMBER_RANGE_ERROR)
      }
      return value
    })
    .messages({
      'string.empty': 'LATITUDE_REQUIRED',
      'any.required': 'LATITUDE_REQUIRED',
      'string.pattern.base': 'LATITUDE_INVALID_FORMAT',
      'number.range': 'LATITUDE_OUT_OF_RANGE'
    }),
  longitude: joi
    .string()
    .required()
    .pattern(/^-?\d+\.\d{6}$/)
    .custom((value, helpers) => {
      const longitude = parseFloat(value)
      if (longitude < MIN_LONGITUDE || longitude > MAX_LONGITUDE) {
        return helpers.error(NUMBER_RANGE_ERROR)
      }
      return value
    })
    .messages({
      'string.empty': 'LONGITUDE_REQUIRED',
      'any.required': 'LONGITUDE_REQUIRED',
      'string.pattern.base': 'LONGITUDE_INVALID_FORMAT',
      'number.range': 'LONGITUDE_OUT_OF_RANGE'
    })
})

const osgb36CoordinateSchema = joi.object({
  eastings: joi
    .string()
    .required()
    .pattern(/^\d{6}$/)
    .custom((value, helpers) => {
      const eastings = parseInt(value, 10)
      if (eastings < MIN_EASTINGS_LENGTH || eastings > MAX_EASTINGS_LENGTH) {
        return helpers.error(NUMBER_RANGE_ERROR)
      }
      return value
    })
    .messages({
      'string.empty': 'EASTINGS_REQUIRED',
      'any.required': 'EASTINGS_REQUIRED',
      'string.pattern.base': 'EASTINGS_INVALID_FORMAT',
      'number.range': 'EASTINGS_OUT_OF_RANGE'
    }),
  northings: joi
    .string()
    .required()
    .pattern(/^\d{6,7}$/)
    .custom((value, helpers) => {
      const northings = parseInt(value, 10)
      if (
        northings < MIN_NORTHINGS_LENGTH ||
        northings > MAX_NORTHINGS_LENGTH
      ) {
        return helpers.error(NUMBER_RANGE_ERROR)
      }
      return value
    })
    .messages({
      'string.empty': 'NORTHINGS_REQUIRED',
      'any.required': 'NORTHINGS_REQUIRED',
      'string.pattern.base': 'NORTHINGS_INVALID_FORMAT',
      'number.range': 'NORTHINGS_OUT_OF_RANGE'
    })
})

export const multipleCoordinatesPatchSchema = joi
  .object({
    coordinateSystem: joi
      .string()
      .valid(COORDINATE_SYSTEMS.WGS84, COORDINATE_SYSTEMS.OSGB36)
      .required()
      .messages({
        'any.only': 'COORDINATE_SYSTEM_INVALID',
        'any.required': 'COORDINATE_SYSTEM_REQUIRED'
      }),
    coordinates: joi
      .array()
      .min(3)
      .when('coordinateSystem', {
        is: COORDINATE_SYSTEMS.WGS84,
        then: joi.array().items(wgs84CoordinateSchema),
        otherwise: joi.array().items(osgb36CoordinateSchema)
      })
      .required()
      .messages({
        'array.min': 'COORDINATES_MINIMUM_THREE_REQUIRED',
        'any.required': 'COORDINATES_REQUIRED'
      })
  })
  .append(exemptionId)

export const multipleCoordinatesPostSchema = multipleCoordinatesPatchSchema

export const multipleCoordinatesGetParamsSchema = joi.object({
  exemptionId: joi.string().length(24).hex().required().messages({
    'string.empty': 'EXEMPTION_ID_REQUIRED',
    'string.length': 'EXEMPTION_ID_REQUIRED',
    'string.hex': 'EXEMPTION_ID_INVALID',
    'any.required': 'EXEMPTION_ID_REQUIRED'
  })
})
