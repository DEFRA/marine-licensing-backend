import joi from 'joi'

export const DAY_PATTERN = /^(0?[1-9]|[12]\d|3[01])$/
export const MONTH_PATTERN = /^(0?[1-9]|1[0-2])$/
export const YEAR_PATTERN = /^\d{4}$/

export const datePartSchema = (pattern, errorPrefix, part) =>
  joi
    .string()
    .pattern(pattern)
    .required()
    .messages({
      'any.required': `${errorPrefix}_${part}_REQUIRED`,
      'string.empty': `${errorPrefix}_${part}_REQUIRED`,
      'string.pattern.base': `${errorPrefix}_${part}_INVALID`
    })

export const getMinYear = () => new Date().getFullYear()

export const toDate = ({ day, month, year }) =>
  new Date(Number(year), Number(month) - 1, Number(day))

export const isRealDate = (value) => {
  const date = toDate(value)

  return (
    date.getFullYear() === Number(value.year) &&
    date.getMonth() === Number(value.month) - 1 &&
    date.getDate() === Number(value.day)
  )
}

export const isAfterToday = (value) => {
  const date = toDate(value)
  const today = new Date()

  date.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)

  return date > today
}

const isSameYearAndEndMonthBefore = (start, end) =>
  Number(end.year) === Number(start.year) &&
  Number(end.month) < Number(start.month)

export const isEndBeforeStart = (start, end) =>
  Number(end.year) < Number(start.year) ||
  isSameYearAndEndMonthBefore(start, end)

export const isBeforeCurrentMonth = ({ month, year }) => {
  const now = new Date()
  return (
    Number(year) < now.getFullYear() ||
    (Number(year) === now.getFullYear() && Number(month) - 1 < now.getMonth())
  )
}
