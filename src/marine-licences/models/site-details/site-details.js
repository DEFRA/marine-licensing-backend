import joi from 'joi'
import { marineLicenceId } from '../shared-models.js'
import { coordinatesTypeFieldSchema } from '../../../exemptions/models/site-details/coordinates-type.js'
import { fileUploadConditionalSiteItemFields } from '../../../shared/models/site-details/file-upload.js'

export const siteDetailsSchema = joi
  .object({
    siteDetails: joi
      .array()
      .items({
        coordinatesType: coordinatesTypeFieldSchema,
        ...fileUploadConditionalSiteItemFields
      })
      .required()
      .messages({
        'any.required': 'SITE_DETAILS_REQUIRED'
      })
  })
  .append(marineLicenceId)
