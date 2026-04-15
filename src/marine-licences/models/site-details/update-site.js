import joi from 'joi'
import { marineLicenceId } from '../shared-models.js'
import { siteItemSchema } from './site-details.js'

export const updateSiteSchema = joi
  .object({ siteDetails: siteItemSchema })
  .append({
    siteIndex: joi.number().integer().min(0).required().messages({
      'number.base': 'SITE_INDEX_REQUIRED',
      'number.integer': 'SITE_INDEX_INVALID',
      'number.min': 'SITE_INDEX_INVALID',
      'any.required': 'SITE_INDEX_REQUIRED'
    })
  })
  .append(marineLicenceId)
