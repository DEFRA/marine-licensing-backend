import joi from 'joi'
import { marineLicenceId } from '../shared-models.js'
import { coordinatesTypeFieldSchema } from '../../../exemptions/models/site-details/coordinates-type.js'
import { fileUploadConditionalSiteItemFields } from '../../../shared/models/site-details/file-upload.js'

export const siteItemSchema = joi.object({
  coordinatesType: coordinatesTypeFieldSchema,
  siteName: joi.string().optional(),
  activityDetails: joi.array().optional(),
  ...fileUploadConditionalSiteItemFields
})

export const siteDetailsSchema = joi
  .object({
    siteDetails: joi.array().items(siteItemSchema).required().messages({
      'any.required': 'SITE_DETAILS_REQUIRED'
    })
  })
  .append(marineLicenceId)
