import { format, isValid } from 'date-fns'

const MONTH_YEAR_FORMAT = 'MMMM yyyy'

const isValidMonthYear = ({ month, year }) => {
  const monthNumber = Number(month)
  const yearNumber = Number(year)

  return (
    Number.isInteger(monthNumber) &&
    monthNumber >= 1 &&
    monthNumber <= 12 &&
    Number.isInteger(yearNumber) &&
    yearNumber >= 1000 &&
    yearNumber <= 9999
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
