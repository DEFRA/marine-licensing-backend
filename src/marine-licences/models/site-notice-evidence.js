import joi from 'joi'
import { marineLicenceId } from './shared-models.js'
import {
  s3LocationFieldSchema,
  uploadedFileFieldSchema
} from '../../shared/models/site-details/file-upload.js'
import {
  datePartSchema,
  DAY_PATTERN,
  isAfterToday,
  isRealDate,
  MONTH_PATTERN,
  YEAR_PATTERN
} from './date-utils.js'

const LOCATION_NAME_MAX_LENGTH = 250

const dateDisplayedSchema = joi
  .object({
    day: datePartSchema(DAY_PATTERN, 'DATE_DISPLAYED', 'DAY'),
    month: datePartSchema(MONTH_PATTERN, 'DATE_DISPLAYED', 'MONTH'),
    year: datePartSchema(YEAR_PATTERN, 'DATE_DISPLAYED', 'YEAR')
  })
  .custom((value, helpers) => {
    if (!isRealDate(value)) {
      return helpers.error('date.base')
    }

    if (isAfterToday(value)) {
      return helpers.error('date.max')
    }

    return value
  })
  .messages({
    'date.base': 'DATE_DISPLAYED_DATE_INVALID',
    'date.max': 'DATE_DISPLAYED_DATE_TODAY_OR_PAST'
  })

const photoSchema = joi.object({
  uploadedFile: uploadedFileFieldSchema,
  s3Location: s3LocationFieldSchema
})

const evidenceIndexSchema = joi.number().integer().min(0).required().messages({
  'number.base': 'EVIDENCE_INDEX_REQUIRED',
  'number.integer': 'EVIDENCE_INDEX_INVALID',
  'number.min': 'EVIDENCE_INDEX_INVALID',
  'any.required': 'EVIDENCE_INDEX_REQUIRED'
})

export const addSiteNoticeEvidenceSchema = joi
  .object({})
  .append(marineLicenceId)

export const deleteSiteNoticeEvidenceSchema = joi
  .object({ evidenceIndex: evidenceIndexSchema })
  .append(marineLicenceId)

export const updateSiteNoticeEvidenceSchema = joi
  .object({
    evidenceIndex: evidenceIndexSchema,
    locationName: joi
      .string()
      .trim()
      .min(1)
      .max(LOCATION_NAME_MAX_LENGTH)
      .optional()
      .messages({
        'string.empty': 'LOCATION_NAME_REQUIRED',
        'string.min': 'LOCATION_NAME_REQUIRED',
        'string.base': 'LOCATION_NAME_REQUIRED',
        'string.max': 'LOCATION_NAME_MAX_LENGTH'
      }),
    dateDisplayed: dateDisplayedSchema.optional(),
    closeUpPhoto: photoSchema.optional(),
    positionPhoto: photoSchema.optional()
  })
  .or('locationName', 'dateDisplayed', 'closeUpPhoto', 'positionPhoto')
  .messages({
    'object.missing': 'SITE_NOTICE_EVIDENCE_REQUIRED'
  })
  .append(marineLicenceId)
