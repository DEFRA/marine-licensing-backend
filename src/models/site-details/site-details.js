import joi from 'joi'
import { exemptionId } from '../shared-models.js'
import { coordinatesEntryFieldSchema } from './coordinates-entry.js'
import { coordinatesTypeFieldSchema } from './coordinates-type.js'
import { coordinateSystemFieldSchema } from './coordinate-system.js'
import { circleWidthValidationSchema } from './circle-width.js'
import { COORDINATE_SYSTEMS } from '../../common/constants/coordinates.js'
import { wgs84ValidationSchema } from './wgs84.js'
import { osgb36ValidationSchema } from './osgb36.js'

export const siteDetailsSchema = joi
  .object({
    siteDetails: joi
      .object({
        coordinatesEntry: coordinatesEntryFieldSchema,
        coordinatesType: coordinatesTypeFieldSchema,
        coordinateSystem: coordinateSystemFieldSchema,
        circleWidth: circleWidthValidationSchema,
        coordinates: joi.when('coordinateSystem', {
          is: COORDINATE_SYSTEMS.WGS84,
          then: wgs84ValidationSchema,
          otherwise: osgb36ValidationSchema
        })
      })
      .required()
      .messages({
        'any.required': 'SITE_DETAILS_REQUIRED'
      })
  })
  .append(exemptionId)
