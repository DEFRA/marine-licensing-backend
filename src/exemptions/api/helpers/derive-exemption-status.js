import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import { getProjectStartEndDates } from './get-project-start-end-dates.js'

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
