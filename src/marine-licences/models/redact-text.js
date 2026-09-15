import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

const ACTIVITY = 'siteDetails.activityDetails'

const ACTIVITY_FIELDS = [
  'activityType',
  'activityTypeLabel',
  'activitySubType',
  'activitySubTypeLabel',
  'activities.selections',
  'activities.selectionLabels',
  'activities.otherActivity',
  'activityDescription',
  'activityDuration',
  'activityMonths.months',
  'activityMonths.details',
  'completionDate.date',
  'completionDate.reason',
  'workingHours'
]

// redaction specific flag
export const WITHHOLD_LOCATION_FIELD = 'siteDetails.withholdLocation'

export const REDACTABLE_FIELDS = [
  'projectName',
  'projectBackground',
  'preferredDates',
  'specialLegalPowers.agree',
  'specialLegalPowers.details',
  'harbourAuthority.area',
  'harbourAuthority.details',
  'publicConsultation.consulted',
  'publicConsultation.details',
  'otherAuthorities.agree',
  'otherAuthorities.details',
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
  { index, activityIndex, policyCode }
) =>
  fieldKey
    .replace('siteDetails', `siteDetails.${index}`)
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
    index: indexSchema,
    activityIndex: indexSchema,
    policyCode: joi.string(),
    withhold: joi.when('fieldKey', {
      is: WITHHOLD_LOCATION_FIELD,
      then: joi.boolean().required().messages({
        'boolean.base': 'WITHHOLD_INVALID',
        'any.required': 'WITHHOLD_REQUIRED'
      }),
      otherwise: joi.forbidden().messages({
        'any.unknown': 'WITHHOLD_NOT_ALLOWED'
      })
    }),
    text: joi
      .when('fieldKey', {
        is: WITHHOLD_LOCATION_FIELD,
        then: joi.string().allow('').optional(),
        otherwise: joi.string().trim().required()
      })
      .messages({
        'string.empty': 'REDACTION_TEXT_REQUIRED',
        'any.required': 'REDACTION_TEXT_REQUIRED'
      })
  })
  .append(marineLicenceId)
