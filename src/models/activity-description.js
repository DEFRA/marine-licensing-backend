import joi from 'joi'
import { exemptionId } from './shared-models.js'

export const activityDescriptionSchema = joi
  .object({
    activityDescription: joi.string().required().min(1).max(1000).messages({
      'string.empty': 'ACTIVITY_DESCRIPTION_REQUIRED',
      'string.max': 'ACTIVITY_DESCRIPTION_MAX_LENGTH',
      'any.required': 'ACTIVITY_DESCRIPTION_REQUIRED'
    })
  })
  .append(exemptionId)
