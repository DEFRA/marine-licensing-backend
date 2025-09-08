import joi from 'joi'
import { exemptionId } from '../shared-models.js'
import { activityDescriptionSchema } from '../activity-description.js'
import { coordinatesEntryFieldSchema } from './coordinates-entry.js'
import { coordinatesTypeFieldSchema } from './coordinates-type.js'
import { coordinateSystemFieldSchema } from './coordinate-system.js'
import { circleWidthValidationSchema } from './circle-width.js'
import { COORDINATE_SYSTEMS } from '../../common/constants/coordinates.js'
import {
  wgs84ValidationSchema,
  wgs84MultipleValidationSchema
} from './wgs84.js'
import {
  osgb36ValidationSchema,
  osgb36MultipleValidationSchema
} from './osgb36.js'
import {
  fileUploadTypeFieldSchema,
  geoJSONFieldSchema,
  featureCountFieldSchema,
  uploadedFileFieldSchema,
  s3LocationFieldSchema
} from './file-upload.js'
import { multipleSiteDetailsSchema } from './multiple-site-details.js'
import { siteNameFieldSchema } from './site-name.js'
import { activityDatesSchema } from '../activity-dates.js'

export const siteDetailsSchema = joi
  .object({
    multipleSiteDetails: joi.when('siteDetails.coordinatesType', {
      is: 'coordinates',
      then: multipleSiteDetailsSchema.required(),
      otherwise: multipleSiteDetailsSchema.optional()
    }),
    siteDetails: joi
      .object({
        coordinatesType: coordinatesTypeFieldSchema,
        activityDates: joi.when('coordinatesType', {
          is: 'coordinates',
          then: activityDatesSchema,
          otherwise: joi.forbidden()
        }),
        activityDescription: joi.when('coordinatesType', {
          is: 'coordinates',
          then: activityDescriptionSchema,
          otherwise: joi.forbidden()
        }),
        siteName: joi.when('/multipleSiteDetails.multipleSitesEnabled', {
          is: true,
          then: joi.when('coordinatesType', {
            is: 'coordinates',
            then: siteNameFieldSchema,
            otherwise: joi.forbidden()
          }),
          otherwise: joi.forbidden()
        }),
        // File upload fields (conditional)
        fileUploadType: joi.when('coordinatesType', {
          is: 'file',
          then: fileUploadTypeFieldSchema,
          otherwise: joi.forbidden()
        }),
        geoJSON: joi.when('coordinatesType', {
          is: 'file',
          then: geoJSONFieldSchema,
          otherwise: joi.forbidden()
        }),
        featureCount: joi.when('coordinatesType', {
          is: 'file',
          then: featureCountFieldSchema,
          otherwise: joi.forbidden()
        }),
        uploadedFile: joi.when('coordinatesType', {
          is: 'file',
          then: uploadedFileFieldSchema,
          otherwise: joi.forbidden()
        }),
        s3Location: joi.when('coordinatesType', {
          is: 'file',
          then: s3LocationFieldSchema,
          otherwise: joi.forbidden()
        }),
        // Manual coordinate fields (conditional)
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
              otherwise: osgb36MultipleValidationSchema
            })
          }),
          otherwise: joi.forbidden()
        })
      })
      .required()
      .messages({
        'any.required': 'SITE_DETAILS_REQUIRED'
      })
  })
  .append(exemptionId)
