import joi from 'joi'
import { exemptionId } from './shared-models.js'
import { COORDINATE_SYSTEMS } from '../common/constants/coordinates.js'

const wgs84CoordinateSchema = joi.object({
  latitude: joi
    .string()
    .required()
    .pattern(/^-?\d+\.\d{6}$/)
    .custom((value, helpers) => {
      const latitude = parseFloat(value)
      if (latitude < -90 || latitude > 90) {
        return helpers.error('number.range')
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
      if (longitude < -180 || longitude > 180) {
        return helpers.error('number.range')
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
      if (eastings < 100000 || eastings > 999999) {
        return helpers.error('number.range')
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
      if (northings < 100000 || northings > 9999999) {
        return helpers.error('number.range')
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
