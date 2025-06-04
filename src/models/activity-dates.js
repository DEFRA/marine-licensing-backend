import joi from 'joi'
import { exemptionId } from './shared-models.js'

export const activityDatesSchema = joi
  .object({
    activityStartDate: joi
      .object({
        day: joi.number().min(1).max(31).required(),
        month: joi.number().min(1).max(12).required(),
        year: joi.number().required()
      })
      .required()
      .messages({
        'date.base': 'ACTIVITY_START_DATE_INVALID',
        'any.required': 'ACTIVITY_START_DATE_REQUIRED'
      }),
    activityEndDate: joi
      .object({
        day: joi.number().min(1).max(31).required(),
        month: joi.number().min(1).max(12).required(),
        year: joi.number().required()
      })
      .required()
      .messages({
        'date.base': 'ACTIVITY_END_DATE_INVALID',
        'any.required': 'ACTIVITY_END_DATE_REQUIRED'
      })
  })
  .append(exemptionId)
