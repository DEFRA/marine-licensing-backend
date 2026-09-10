import { SCHEDULER_TIMEZONE } from '../constants/job-scheduler.js'

const londonDateParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: SCHEDULER_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

export const londonToday = (now = new Date()) => {
  const parts = londonDateParts.formatToParts(now)
  const datePart = (type) => parts.find((part) => part.type === type).value

  return new Date(
    `${datePart('year')}-${datePart('month')}-${datePart('day')}T00:00:00.000Z`
  )
}
