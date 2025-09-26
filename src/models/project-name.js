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

const ORG_STRING_MIN_LENGTH = 1
const ORG_ID_MAX_LENGTH = 50
const ORG_NAME_MAX_LENGTH = 200

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
    }),
  applicantOrganisationId: joi
    .string()
    .min(ORG_STRING_MIN_LENGTH)
    .max(ORG_ID_MAX_LENGTH)
    .messages({
      'string.empty': 'APPLICANT_ORGANISATION_ID_REQUIRED',
      'string.max': 'APPLICANT_ORGANISATION_ID_MAX_LENGTH',
      'any.required': 'APPLICANT_ORGANISATION_ID_REQUIRED'
    }),
  applicantOrganisationName: joi.when('applicantOrganisationId', {
    is: joi.exist(),
    then: joi
      .string()
      .required()
      .min(ORG_STRING_MIN_LENGTH)
      .max(ORG_NAME_MAX_LENGTH)
      .messages({
        'string.empty': 'APPLICANT_ORGANISATION_NAME_REQUIRED',
        'string.max': 'APPLICANT_ORGANISATION_NAME_MAX_LENGTH',
        'any.required': 'APPLICANT_ORGANISATION_NAME_REQUIRED'
      })
  })
})

export const createProjectName = projectName.append(mcmsContext)

export const updateProjectName = projectName.append(exemptionId)
