import joi from 'joi'
import { marineLicenceId } from './shared-models.js'
import { s3LocationFieldSchema } from '../../shared/models/site-details/file-upload.js'

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

// redaction specific flags - these store a bare boolean, not replacement text
export const WITHHOLD_LOCATION_FIELD = 'siteDetails.withholdLocation'
export const WITHHOLD_FIELDS = [
  WITHHOLD_LOCATION_FIELD,
  'waterFrameworkDirective.withholdDocument',
  'siteDetails.constructionDrawings.withholdDocument'
]

export const WITHHOLD_DOCUMENT_FIELDS = WITHHOLD_FIELDS.filter((field) =>
  field.endsWith('withholdDocument')
)

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
  ...WITHHOLD_FIELDS,
  ...ACTIVITY_FIELDS.map((field) => `${ACTIVITY}.${field}`)
]

export const buildFieldPath = (
  fieldKey,
  { siteIndex, activityIndex, drawingIndex, policyCode }
) =>
  fieldKey
    .replace('siteDetails', `siteDetails.${siteIndex}`)
    .replace('activityDetails', `activityDetails.${activityIndex}`)
    .replace('constructionDrawings', `constructionDrawings.${drawingIndex}`)
    .replace(
      'marinePlanPolicyResponses',
      `marinePlanPolicyResponses.${policyCode}`
    )

const indexSchema = joi.number().integer().min(0).messages({
  'number.base': 'REDACTION_INDEX_INVALID',
  'number.integer': 'REDACTION_INDEX_INVALID',
  'number.min': 'REDACTION_INDEX_INVALID'
})

const replacementDocumentFields = {
  filename: joi
    .string()
    .when('s3Location', { is: joi.exist(), then: joi.required() })
    .messages({
      'string.empty': 'UPLOADED_FILE_FILENAME_REQUIRED',
      'any.required': 'UPLOADED_FILE_FILENAME_REQUIRED'
    }),
  s3Location: s3LocationFieldSchema.optional()
}

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
    drawingIndex: indexSchema,
    policyCode: joi.string(),
    remove: joi.boolean(),
    withhold: joi.boolean().messages({ 'boolean.base': 'WITHHOLD_INVALID' }),
    ...replacementDocumentFields,
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
      .when('s3Location', {
        is: joi.exist(),
        then: joi.string().allow('').optional()
      })
      .messages({
        'string.empty': 'REDACTION_TEXT_REQUIRED',
        'any.required': 'REDACTION_TEXT_REQUIRED'
      })
  })
  .append(marineLicenceId)
