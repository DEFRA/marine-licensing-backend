import joi from 'joi'
import { marineLicenceId } from '../shared-models.js'
import { coordinatesTypeFieldSchema } from '../../../shared/models/site-details/coordinates-type.js'
import { fileUploadConditionalSiteItemFields } from '../../../shared/models/site-details/file-upload.js'
import { siteNameFieldSchema } from '../../../shared/models/site-details/site-name.js'
import { activityItemSchema } from '../activity-details/activity-details.js'
import { coordinatesEntryFieldSchema } from '../../../shared/models/site-details/coordinates-entry.js'
import { coordinateSystemFieldSchema } from '../../../shared/models/site-details/coordinate-system.js'
import { circleWidthValidationSchema } from '../../../shared/models/site-details/circle-width.js'
import { COORDINATE_SYSTEMS } from '../../../shared/common/constants/coordinates.js'
import {
  wgs84ValidationSchema,
  wgs84MultipleValidationSchema
} from '../../../shared/models/site-details/wgs84.js'
import { osgb36ValidationSchema } from '../../../shared/models/site-details/osgb36.js'
import { osgb36MultipleCoordinatesSchema } from './osgb36.js'

export const siteItemSchema = joi.object({
  coordinatesType: coordinatesTypeFieldSchema,
  siteName: joi.when('coordinatesType', {
    is: 'coordinates',
    then: siteNameFieldSchema,
    otherwise: siteNameFieldSchema.optional()
  }),
  activityDetails: joi.array().items(activityItemSchema).optional(),
  ...fileUploadConditionalSiteItemFields,
  coordinatesEntry: joi.when('coordinatesType', {
    is: 'coordinates',
    then: coordinatesEntryFieldSchema,
    otherwise: joi.forbidden()
  }),
  coordinateSystem: joi.when('coordinatesType', {
    is: 'coordinates',
    then: coordinateSystemFieldSchema,
    otherwise: joi.forbidden()
  }),
  circleWidth: joi.when('coordinatesType', {
    is: 'coordinates',
    then: joi.alternatives().conditional('coordinatesEntry', {
      is: 'single',
      then: circleWidthValidationSchema,
      otherwise: joi.forbidden()
    }),
    otherwise: joi.forbidden()
  }),
  coordinates: joi.when('coordinatesType', {
    is: 'coordinates',
    then: joi.alternatives().conditional('coordinatesEntry', {
      is: 'single',
      then: joi.alternatives().conditional('coordinateSystem', {
        is: COORDINATE_SYSTEMS.WGS84,
        then: wgs84ValidationSchema,
        otherwise: osgb36ValidationSchema
      }),
      otherwise: joi.alternatives().conditional('coordinateSystem', {
        is: COORDINATE_SYSTEMS.WGS84,
        then: wgs84MultipleValidationSchema,
        otherwise: osgb36MultipleCoordinatesSchema
      })
    }),
    otherwise: joi.forbidden()
  })
})

export const siteDetailsSchema = joi
  .object({
    siteDetails: joi.array().items(siteItemSchema).required().messages({
      'any.required': 'SITE_DETAILS_REQUIRED'
    })
  })
  .append(marineLicenceId)
