import joi from 'joi'
import { marineLicenceId } from '../shared-models.js'
import { activityTypeFields } from './activity-type.js'
import { activityDurationSchema } from './activity-duration.js'
import { activityDescriptionSchema } from './activity-description.js'
import { activityMonthsSchema } from './activity-months.js'

export const activityItemSchema = joi.object({
  ...activityTypeFields,
  activityDescription: activityDescriptionSchema,
  activityDuration: activityDurationSchema,
  completionDate: joi.string().optional().allow(''),
  activityMonths: activityMonthsSchema,
  workingHours: joi.string().optional().allow('')
})

export const activityDetailsSchema = joi
  .object({
    siteIndex: joi.number().integer().min(0).required().messages({
      'number.base': 'SITE_INDEX_REQUIRED',
      'number.integer': 'SITE_INDEX_INVALID',
      'number.min': 'SITE_INDEX_INVALID',
      'any.required': 'SITE_INDEX_REQUIRED'
    })
  })
  .append(marineLicenceId)
