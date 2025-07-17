import joi from 'joi'
import { exemptionId } from '../shared-models.js'
import { coordinatesEntryFieldSchema } from './coordinates-entry.js'
import { coordinatesTypeFieldSchema } from './coordinates-type.js'
import { coordinateSystemFieldSchema } from './coordinate-system.js'
import { circleWidthValidationSchema } from './circle-width.js'
import { COORDINATE_SYSTEMS } from '../../common/constants/coordinates.js'
import { wgs84ValidationSchema } from './wgs84.js'
import { osgb36ValidationSchema } from './osgb36.js'

const circleWidthOptionalSchema = joi
  .string()
  .optional()
  .custom((value, helpers) => {
    if (value === undefined || value === null) {
      return value
    }

    const width = Number(value)

    if (isNaN(width)) {
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
    'number.base': 'WIDTH_INVALID',
    'number.min': 'WIDTH_MIN',
    'number.integer': 'WIDTH_NON_INTEGER'
  })

export const siteDetailsSchema = joi
  .object({
    siteDetails: joi
      .object({
        coordinatesEntry: coordinatesEntryFieldSchema,
        coordinatesType: coordinatesTypeFieldSchema,
        coordinateSystem: coordinateSystemFieldSchema,
        circleWidth: joi.when('coordinatesEntry', {
          is: 'single',
          then: circleWidthValidationSchema,
          otherwise: circleWidthOptionalSchema
        }),
        coordinates: joi.when('coordinateSystem', {
          is: COORDINATE_SYSTEMS.WGS84,
          then: joi
            .alternatives()
            .try(
              wgs84ValidationSchema,
              joi.array().items(wgs84ValidationSchema).min(1)
            ),
          otherwise: joi
            .alternatives()
            .try(
              osgb36ValidationSchema,
              joi.array().items(osgb36ValidationSchema).min(1)
            )
        })
      })
      .required()
      .messages({
        'any.required': 'SITE_DETAILS_REQUIRED'
      })
  })
  .append(exemptionId)
