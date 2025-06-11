import joi from 'joi'
import { exemptionId } from './shared-models.js'

const MIN_YEAR = new Date().getFullYear()
const MAX_YEAR_OFFSET = 20
const MAX_YEAR = MIN_YEAR + MAX_YEAR_OFFSET

const MIN_DATE = new Date()
MIN_DATE.setHours(0, 0, 0, 0)

const MAX_DATE = new Date(MAX_YEAR, 11, 31)

export const activityDatesSchema = joi
  .object()
  .keys({
    start: joi.date().required().min(MIN_DATE).max(MAX_DATE).messages({
      'any.required': 'CUSTOM_START_DATE_MISSING',
      'date.base': 'CUSTOM_START_DATE_INVALID',
      'date.min': 'CUSTOM_START_DATE_TODAY_OR_FUTURE',
      'date.max': 'CUSTOM_START_DATE_TODAY_OR_FUTURE'
    }),
    end: joi
      .date()
      .required()
      .greater(joi.ref('start'))
      .max(MAX_DATE)
      .messages({
        'any.required': 'CUSTOM_END_DATE_MISSING',
        'date.base': 'CUSTOM_END_DATE_INVALID',
        'date.greater': 'CUSTOM_END_DATE_BEFORE_START_DATE',
        'date.max': 'CUSTOM_END_DATE_TOO_LATE'
      })
  })
  .append(exemptionId)
