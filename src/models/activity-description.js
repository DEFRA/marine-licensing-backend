import joi from 'joi'
import { exemptionId } from './shared-models.js'

export const ACTIVITY_MIN_LENGTH = 1
export const ACTIVITY_DESCRIPTION_MAX_LENGTH = 4000

export const activityDescriptionSchema = joi
  .object({
    activityDescription: joi
      .string()
      .required()
      .min(ACTIVITY_MIN_LENGTH)
      .max(ACTIVITY_DESCRIPTION_MAX_LENGTH)
      .messages({
        'string.empty': 'ACTIVITY_DESCRIPTION_REQUIRED',
        'string.max': 'ACTIVITY_DESCRIPTION_MAX_LENGTH',
        'any.required': 'ACTIVITY_DESCRIPTION_REQUIRED'
      })
  })
  .append(exemptionId)
