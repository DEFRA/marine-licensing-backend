import joi from 'joi'
import { exemptionId } from './shared-models.js'

const PROJECT_NAME_MAX_LENGTH = 250

const mcmsContext = {
  mcmsContext: joi
    .object({
      activityType: joi.string(),
      activitySubtype: joi.string(),
      article: joi.string(),
      pdfDownloadUrl: joi.string()
    })
    .allow(null)
}

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

export const createProjectName = projectName.append(mcmsContext)

export const updateProjectName = projectName.append(exemptionId)
