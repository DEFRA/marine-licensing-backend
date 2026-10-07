import joi from 'joi'
import { marineLicenceId } from './shared-models.js'
import {
  datePartSchema,
  getMinYear,
  isBeforeCurrentMonth,
  isEndBeforeStart,
  MONTH_PATTERN,
  YEAR_PATTERN
} from './date-utils.js'

const preferredDatePartSchema = (
  errorPrefix,
  { validateTodayOrLater = false } = {}
) =>
  joi
    .object({
      month: datePartSchema(MONTH_PATTERN, errorPrefix, 'MONTH'),
      year: datePartSchema(YEAR_PATTERN, errorPrefix, 'YEAR')
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
