import joi from 'joi'
import { exemptionId } from './shared-models.js'

const PROJECT_NAME_MAX_LENGTH = 250

export const projectName = joi.object({
  projectName: joi
    .string()
    .min(1)
    .max(PROJECT_NAME_MAX_LENGTH)
    .required()
    .messages({
      'string.empty': 'PROJECT_NAME_REQUIRED',
      'string.max': 'PROJECT_NAME_MAX_LENGTH',
      'any.required': 'PROJECT_NAME_REQUIRED'
    })
})

export const updateProjectName = projectName.append(exemptionId)
