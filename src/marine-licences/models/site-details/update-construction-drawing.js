import joi from 'joi'
import { marineLicenceId } from '../shared-models.js'

export const updateConstructionDrawingSchema = joi
  .object({
    siteIndex: joi.number().integer().min(0).required().messages({
      'number.base': 'SITE_INDEX_REQUIRED',
      'number.integer': 'SITE_INDEX_INVALID',
      'number.min': 'SITE_INDEX_INVALID',
      'any.required': 'SITE_INDEX_REQUIRED'
    }),
    drawingIndex: joi.number().integer().min(0).required().messages({
      'number.base': 'DRAWING_INDEX_REQUIRED',
      'number.integer': 'DRAWING_INDEX_INVALID',
      'number.min': 'DRAWING_INDEX_INVALID',
      'any.required': 'DRAWING_INDEX_REQUIRED'
    }),
    filename: joi.string().required().messages({
      'any.required': 'UPLOADED_FILE_FILENAME_REQUIRED',
      'string.empty': 'UPLOADED_FILE_FILENAME_REQUIRED'
    }),
    s3Location: joi
      .object({
        s3Bucket: joi.string().required().messages({
          'any.required': 'S3_BUCKET_REQUIRED',
          'string.empty': 'S3_BUCKET_REQUIRED'
        }),
        s3Key: joi.string().required().messages({
          'any.required': 'S3_KEY_REQUIRED',
          'string.empty': 'S3_KEY_REQUIRED'
        }),
        checksumSha256: joi.string().required().messages({
          'any.required': 'CHECKSUM_REQUIRED',
          'string.empty': 'CHECKSUM_REQUIRED'
        })
      })
      .required()
      .messages({
        'any.required': 'S3_LOCATION_REQUIRED',
        'object.base': 'S3_LOCATION_INVALID'
      })
  })
  .append(marineLicenceId)
