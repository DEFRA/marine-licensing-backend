import { format } from 'date-fns'

const MONTH_YEAR_FORMAT = 'MMMM yyyy'

const formatMonthYear = ({ month, year }) =>
  format(new Date(Number(year), Number(month) - 1, 1), MONTH_YEAR_FORMAT)

export const formatPreferredDates = (preferredDates) => {
  if (!preferredDates?.start || !preferredDates?.end) {
    return null
  }

  return `${formatMonthYear(preferredDates.start)} to ${formatMonthYear(preferredDates.end)}`
}
