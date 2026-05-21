import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

const MIN_YEAR = new Date().getFullYear()
const MAX_YEAR_OFFSET = 20
const MAX_YEAR = MIN_YEAR + MAX_YEAR_OFFSET

const MAX_DAYS_IN_MONTH = 31
const MAX_MONTHS_IN_YEAR = 12

const MAX_DATE = new Date(MAX_YEAR, MAX_MONTHS_IN_YEAR, MAX_DAYS_IN_MONTH)

const startOfToday = () => {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
}

const isTodayOrLater = (value, helpers) => {
  const date = new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  )

  if (date < startOfToday()) {
    return helpers.error('date.min')
  }

  return value
}

export const preferredDatesRangeSchema = joi.object({
  start: joi.date().required().custom(isTodayOrLater).max(MAX_DATE).messages({
    'any.required': 'PREFERRED_START_DATE_REQUIRED',
    'date.base': 'PREFERRED_START_DATE_INVALID',
    'date.min': 'PREFERRED_START_DATE_TODAY_OR_FUTURE',
    'date.max': 'PREFERRED_START_DATE_INVALID'
  }),
  end: joi.date().required().min(joi.ref('start')).max(MAX_DATE).messages({
    'any.required': 'PREFERRED_END_DATE_REQUIRED',
    'date.base': 'PREFERRED_END_DATE_INVALID',
    'date.greater': 'PREFERRED_END_DATE_BEFORE_START_DATE',
    'date.min': 'PREFERRED_END_DATE_BEFORE_START_DATE',
    'date.max': 'PREFERRED_END_DATE_INVALID'
  })
})

export const preferredDates = preferredDatesRangeSchema.append(marineLicenceId)
