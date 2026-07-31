import joi from 'joi'
import { marineLicenceId } from '../shared-models.js'

export const constructionDrawingSchema = joi.object({
  filename: joi.string().optional(),
  s3Location: joi
    .object({
      s3Bucket: joi.string().required(),
      s3Key: joi.string().required(),
      checksumSha256: joi.string().required()
    })
    .optional()
})

export const addConstructionDrawingSchema = joi
  .object({
    siteIndex: joi.number().integer().min(0).required().messages({
      'number.base': 'SITE_INDEX_REQUIRED',
      'number.integer': 'SITE_INDEX_INVALID',
      'number.min': 'SITE_INDEX_INVALID',
      'any.required': 'SITE_INDEX_REQUIRED'
    })
  })
  .append(marineLicenceId)
