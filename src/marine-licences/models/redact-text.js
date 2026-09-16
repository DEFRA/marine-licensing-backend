import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

const ACTIVITY = 'siteDetails.activityDetails'

const ACTIVITY_FIELDS = [
  'activityType',
  'activitySubType',
  'activities',
  'activityDescription',
  'activityDuration',
  'activityMonths',
  'completionDate',
  'workingHours'
]

// redaction specific flag
export const WITHHOLD_LOCATION_FIELD = 'siteDetails.withholdLocation'

export const REDACTABLE_FIELDS = [
  'projectName',
  'projectBackground',
  'preferredDates',
  'specialLegalPowers',
  'harbourAuthority',
  'publicConsultation',
  'otherAuthorities',
  'waterFrameworkDirective.nauticalMile',
  'waterFrameworkDirective.excludedActivities',
  'marinePlanPolicyResponses',
  'siteDetails.siteName',
  'siteDetails.circleWidth',
  WITHHOLD_LOCATION_FIELD,
  ...ACTIVITY_FIELDS.map((field) => `${ACTIVITY}.${field}`)
]

export const buildFieldPath = (
  fieldKey,
  { siteIndex, activityIndex, policyCode }
) =>
  fieldKey
    .replace('siteDetails', `siteDetails.${siteIndex}`)
    .replace('activityDetails', `activityDetails.${activityIndex}`)
    .replace(
      'marinePlanPolicyResponses',
      `marinePlanPolicyResponses.${policyCode}`
    )

const indexSchema = joi.number().integer().min(0).messages({
  'number.base': 'REDACTION_INDEX_INVALID',
  'number.integer': 'REDACTION_INDEX_INVALID',
  'number.min': 'REDACTION_INDEX_INVALID'
})

export const redactText = joi
  .object({
    fieldKey: joi
      .string()
      .valid(...REDACTABLE_FIELDS)
      .required()
      .messages({
        'string.empty': 'REDACTION_FIELD_KEY_REQUIRED',
        'any.only': 'REDACTION_FIELD_KEY_INVALID',
        'any.required': 'REDACTION_FIELD_KEY_REQUIRED'
      }),
    siteIndex: indexSchema,
    activityIndex: indexSchema,
    policyCode: joi.string(),
    remove: joi.boolean(),
    withhold: joi.boolean().messages({ 'boolean.base': 'WITHHOLD_INVALID' }),
    text: joi
      .string()
      .trim()
      .required()
      .when('remove', {
        is: joi.exist(),
        then: joi.string().allow('').optional()
      })
      .when('withhold', {
        is: joi.exist(),
        then: joi.string().allow('').optional()
      })
      .messages({
        'string.empty': 'REDACTION_TEXT_REQUIRED',
        'any.required': 'REDACTION_TEXT_REQUIRED'
      })
  })
  .append(marineLicenceId)
