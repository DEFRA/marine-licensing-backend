import { format, isValid } from 'date-fns'

const MONTH_YEAR_FORMAT = 'MMMM yyyy'
const MIN_MONTH = 1
const MAX_MONTH = 12
const MIN_FOUR_DIGIT_YEAR = 1000
const MAX_FOUR_DIGIT_YEAR = 9999

const isValidMonthYear = ({ month, year }) => {
  const monthNumber = Number(month)
  const yearNumber = Number(year)

  return (
    Number.isInteger(monthNumber) &&
    monthNumber >= MIN_MONTH &&
    monthNumber <= MAX_MONTH &&
    Number.isInteger(yearNumber) &&
    yearNumber >= MIN_FOUR_DIGIT_YEAR &&
    yearNumber <= MAX_FOUR_DIGIT_YEAR
  )
}

const formatMonthYear = ({ month, year }) => {
  if (!isValidMonthYear({ month, year })) {
    return null
  }

  const date = new Date(Number(year), Number(month) - 1, 1)

  if (!isValid(date)) {
    return null
  }

  return format(date, MONTH_YEAR_FORMAT)
}

export const formatPreferredDates = (preferredDates) => {
  if (!preferredDates?.start || !preferredDates?.end) {
    return null
  }

  const start = formatMonthYear(preferredDates.start)
  const end = formatMonthYear(preferredDates.end)

  if (!start || !end) {
    return null
  }

  return `${start} to ${end}`
}
