import { SCHEDULER_TIMEZONE } from '../constants/job-scheduler.js'

// Constructed once: building an Intl formatter is the expensive part.
const londonDateParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: SCHEDULER_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

/**
 * Today's date as the London clock reads it, normalised to UTC midnight so it
 * compares directly against stored activity dates, which are UTC midnight too.
 *
 * Requesting the parts rather than formatting a string keeps the locale out of
 * the result: only the timezone affects it.
 */
export const londonToday = (now = new Date()) => {
  const parts = londonDateParts.formatToParts(now)
  const valueOf = (type) => parts.find((part) => part.type === type).value

  return new Date(
    `${valueOf('year')}-${valueOf('month')}-${valueOf('day')}T00:00:00.000Z`
  )
}
