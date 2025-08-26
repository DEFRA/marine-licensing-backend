import joi from 'joi'
import { exemptionId } from './shared-models.js'
import {
  activityTypes,
  articleCodes,
  validActivitySubtypes
} from '../common/constants/mcms-context.js'

const PROJECT_NAME_MAX_LENGTH = 250

const mcmsContext = {
  mcmsContext: joi
    .object({
      activityType: joi
        .string()
        .valid(...Object.values(activityTypes))
        .required(),
      article: joi
        .string()
        .valid(...articleCodes)
        .required(),
      pdfDownloadUrl: joi.string().required(),
      activitySubtype: joi.when('activityType', {
        is: [
          activityTypes.CON,
          activityTypes.DEPOSIT,
          activityTypes.REMOVAL,
          activityTypes.DREDGE
        ],
        then: joi
          .string()
          .valid(...validActivitySubtypes)
          .required(),
        otherwise: joi.forbidden()
      })
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
