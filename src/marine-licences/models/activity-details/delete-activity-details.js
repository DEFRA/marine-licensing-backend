import joi from 'joi'
import { marineLicenceId } from '../shared-models.js'

export const deleteActivityDetailsSchema = joi
  .object({
    siteIndex: joi.number().integer().min(0).required().messages({
      'number.base': 'SITE_INDEX_REQUIRED',
      'number.integer': 'SITE_INDEX_INVALID',
      'number.min': 'SITE_INDEX_INVALID',
      'any.required': 'SITE_INDEX_REQUIRED'
    }),
    activityIndex: joi.number().integer().min(0).required().messages({
      'number.base': 'ACTIVITY_INDEX_REQUIRED',
      'number.integer': 'ACTIVITY_INDEX_INVALID',
      'number.min': 'ACTIVITY_INDEX_INVALID',
      'any.required': 'ACTIVITY_INDEX_REQUIRED'
    })
  })
  .append(marineLicenceId)
