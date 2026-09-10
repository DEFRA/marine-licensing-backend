import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import { getProjectStartEndDates } from './get-project-start-end-dates.js'

/**
 * The status an exemption's activity dates imply on a given day.
 *
 * Both bounds are inclusive: an activity is active on its start date and still
 * active on its end date, expiring the day after. Multiple sites collapse to the
 * earliest start and the latest end.
 *
 * Returns null when either bound is missing so the caller can decide — that
 * cannot happen for a submitted exemption, where activity dates are mandatory.
 */
export const deriveExemptionStatus = (siteDetails, today) => {
  const { start, end } = getProjectStartEndDates(siteDetails)

  if (!start || !end) {
    return null
  }

  if (new Date(start) > today) {
    return EXEMPTION_STATUS.SCHEDULED
  }

  if (new Date(end) < today) {
    return EXEMPTION_STATUS.EXPIRED
  }

  return EXEMPTION_STATUS.ACTIVE
}
