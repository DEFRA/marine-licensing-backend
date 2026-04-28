import joi from 'joi'
import { marineLicenceId } from '../shared-models.js'
import { coordinatesTypeFieldSchema } from '../../../exemptions/models/site-details/coordinates-type.js'
import { fileUploadConditionalSiteItemFields } from '../../../shared/models/site-details/file-upload.js'
import { siteNameFieldSchema } from '../../../shared/models/site-details/site-name.js'
import { activityItemSchema } from '../activity-details/activity-details.js'

export const siteItemSchema = joi.object({
  coordinatesType: coordinatesTypeFieldSchema,
  siteName: joi.when('coordinatesType', {
    is: 'file',
    then: siteNameFieldSchema.optional(),
    otherwise: joi.forbidden()
  }),
  activityDetails: joi.array().items(activityItemSchema).optional(),
  ...fileUploadConditionalSiteItemFields
})

export const siteDetailsSchema = joi
  .object({
    siteDetails: joi.array().items(siteItemSchema).required().messages({
      'any.required': 'SITE_DETAILS_REQUIRED'
    })
  })
  .append(marineLicenceId)
