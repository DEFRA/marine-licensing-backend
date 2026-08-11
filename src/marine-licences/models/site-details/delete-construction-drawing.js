import joi from 'joi'
import { marineLicenceId } from '../shared-models.js'

export const deleteConstructionDrawingSchema = joi
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
    })
  })
  .append(marineLicenceId)
