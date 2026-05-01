import joi from 'joi'
import { exemptionId } from '../shared-models.js'
import { activityDescriptionSchema } from '../activity-description.js'
import { coordinatesTypeFieldSchema } from '../../../shared/models/site-details/coordinates-type.js'
import { coordinatesEntryFieldSchema } from '../../../shared/models/site-details/coordinates-entry.js'
import { coordinateSystemFieldSchema } from '../../../shared/models/site-details/coordinate-system.js'
import { circleWidthValidationSchema } from '../../../shared/models/site-details/circle-width.js'
import { COORDINATE_SYSTEMS } from '../../../shared/common/constants/coordinates.js'
import {
  wgs84ValidationSchema,
  wgs84MultipleValidationSchema
} from '../../../shared/models/site-details/wgs84.js'
import {
  osgb36ValidationSchema,
  osgb36MultipleValidationSchema
} from '../../../shared/models/site-details/osgb36.js'
import { fileUploadConditionalSiteItemFields } from '../../../shared/models/site-details/file-upload.js'
import { multipleSiteDetailsSchema } from './multiple-site-details.js'
import { siteNameFieldSchema } from '../../../shared/models/site-details/site-name.js'
import { activityDatesSchema } from '../activity-dates.js'

export const siteDetailsSchema = joi
  .object({
    multipleSiteDetails: multipleSiteDetailsSchema.required().messages({
      'any.required': 'MULTIPLE_SITE_DETAILS_REQUIRED'
    }),
    siteDetails: joi
      .array()
      .items({
        coordinatesType: coordinatesTypeFieldSchema,
        activityDates: joi.when('coordinatesType', {
          is: 'coordinates',
          then: activityDatesSchema,
          otherwise: activityDatesSchema.optional()
        }),
        activityDescription: joi.when('coordinatesType', {
          is: 'coordinates',
          then: activityDescriptionSchema,
          otherwise: activityDescriptionSchema.optional()
        }),
        siteName: joi.when('/multipleSiteDetails.multipleSitesEnabled', {
          is: true,
          then: joi.when('coordinatesType', {
            is: 'coordinates',
            then: siteNameFieldSchema,
            otherwise: siteNameFieldSchema.optional()
          }),
          otherwise: joi.forbidden()
        }),
        ...fileUploadConditionalSiteItemFields,
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
