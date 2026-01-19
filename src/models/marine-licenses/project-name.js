import joi from 'joi'
import { marineLicenseId } from './shared-models.js'

const PROJECT_NAME_MAX_LENGTH = 250

const ORG_STRING_MIN_LENGTH = 1

const organisation = {
  organisationId: joi.string().min(ORG_STRING_MIN_LENGTH).messages({
    'string.empty': 'ORGANISATION_ID_REQUIRED',
    'any.required': 'ORGANISATION_ID_REQUIRED'
  }),
  organisationName: joi.when('organisationId', {
    is: joi.exist(),
    then: joi.string().required().min(ORG_STRING_MIN_LENGTH).messages({
      'string.empty': 'ORGANISATION_NAME_REQUIRED',
      'any.required': 'ORGANISATION_NAME_REQUIRED'
    })
  }),
  userRelationshipType: joi
    .string()
    .required()
    .valid('Employee', 'Agent', 'Citizen')
    .messages({
      'string.empty': 'USER_RELATIONSHIP_TYPE_REQUIRED',
      'any.required': 'USER_RELATIONSHIP_TYPE_REQUIRED'
    })
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

export const createProjectName = projectName
  .append(organisation)
  .append({ mcmsContext: joi.object().allow(null) })

export const updateProjectName = projectName.append(marineLicenseId)
