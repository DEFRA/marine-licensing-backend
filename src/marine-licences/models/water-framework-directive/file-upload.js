import joi from 'joi'
import {
  s3LocationFieldSchema,
  uploadedFileFieldSchema
} from '../../../shared/models/site-details/file-upload.js'

export const fileUploadValidationSchema = {
  uploadedFile: joi.when('nauticalMile', {
    is: 'yes',
    then: uploadedFileFieldSchema,
    otherwise: joi.forbidden().messages({
      'any.unknown': 'WATER_FRAMEWORK_DIRECTIVE_INVALID'
    })
  }),
  s3Location: joi.when('nauticalMile', {
    is: 'yes',
    then: s3LocationFieldSchema,
    otherwise: joi.forbidden().messages({
      'any.unknown': 'WATER_FRAMEWORK_DIRECTIVE_INVALID'
    })
  })
}
