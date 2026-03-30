import joi from 'joi'
import { marineLicenceId } from '../shared-models.js'
import { coordinatesTypeFieldSchema } from '../../../exemptions/models/site-details/coordinates-type.js'
import {
  fileUploadTypeFieldSchema,
  geoJSONFieldSchema,
  featureCountFieldSchema,
  uploadedFileFieldSchema,
  s3LocationFieldSchema
} from '../../../shared/models/site-details/file-upload.js'

export const siteDetailsSchema = joi
  .object({
    siteDetails: joi
      .array()
      .items({
        coordinatesType: coordinatesTypeFieldSchema,
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
        })
      })
      .required()
      .messages({
        'any.required': 'SITE_DETAILS_REQUIRED'
      })
  })
  .append(marineLicenceId)
