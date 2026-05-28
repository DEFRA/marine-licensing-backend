import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

const getMinYear = () => new Date().getFullYear()

const MONTH_PATTERN = /^(0?[1-9]|1[0-2])$/
const YEAR_PATTERN = /^\d{4}$/

const isSameYearAndEndMonthBefore = (start, end) =>
  Number(end.year) === Number(start.year) &&
  Number(end.month) < Number(start.month)

const isEndBeforeStart = (start, end) =>
  Number(end.year) < Number(start.year) ||
  isSameYearAndEndMonthBefore(start, end)

const isBeforeCurrentMonth = ({ month, year }) => {
  const now = new Date()
  return (
    Number(year) < now.getFullYear() ||
    (Number(year) === now.getFullYear() && Number(month) - 1 < now.getMonth())
  )
}

const monthSchema = (errorPrefix) =>
  joi
    .string()
    .pattern(MONTH_PATTERN)
    .required()
    .messages({
      'any.required': `${errorPrefix}_MONTH_REQUIRED`,
      'string.empty': `${errorPrefix}_MONTH_REQUIRED`,
      'string.pattern.base': `${errorPrefix}_MONTH_INVALID`
    })

const yearSchema = (errorPrefix) =>
  joi
    .string()
    .pattern(YEAR_PATTERN)
    .required()
    .messages({
      'any.required': `${errorPrefix}_YEAR_REQUIRED`,
      'string.empty': `${errorPrefix}_YEAR_REQUIRED`,
      'string.pattern.base': `${errorPrefix}_YEAR_INVALID`
    })

const preferredDatePartSchema = (
  errorPrefix,
  { validateTodayOrLater = false } = {}
) =>
  joi
    .object({
      month: monthSchema(errorPrefix),
      year: yearSchema(errorPrefix)
    })
    .custom((value, helpers) => {
      const year = Number(value.year)

      if (year < getMinYear()) {
        return helpers.error('number.range')
      }

      if (validateTodayOrLater && isBeforeCurrentMonth(value)) {
        return helpers.error('date.min')
      }

      return value
    })
    .messages({
      'number.range': `${errorPrefix}_YEAR_INVALID`,
      'date.min': `${errorPrefix}_DATE_TODAY_OR_FUTURE`
    })

export const preferredDatesRangeSchema = joi
  .object({
    start: preferredDatePartSchema('PREFERRED_START', {
      validateTodayOrLater: true
    })
      .required()
      .messages({
        'any.required': 'PREFERRED_START_DATE_REQUIRED'
      }),
    end: preferredDatePartSchema('PREFERRED_END').required().messages({
      'any.required': 'PREFERRED_END_DATE_REQUIRED'
    })
  })
  .custom((value, helpers) => {
    if (isEndBeforeStart(value.start, value.end)) {
      return helpers.error('date.min')
    }

    return value
  })
  .messages({
    'date.min': 'PREFERRED_END_DATE_BEFORE_START_DATE'
  })

export const preferredDates = preferredDatesRangeSchema.append(marineLicenceId)
