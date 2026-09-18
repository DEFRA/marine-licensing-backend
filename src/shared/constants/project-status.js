export const PROJECT_STATUS_LABEL = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  REJECTED: 'Rejected',
  SUBMITTED: 'Submitted',
  TRANSFERRED: 'Transferred',
  WITHDRAWN: 'Withdrawn'
}

// Display-only: never stored on a project, derived from outstanding application tasks.
export const ACTION_REQUIRED_STATUS_LABEL = 'Action required'

// Accepted as a dashboard status filter value even though no project stores it;
// getStatusFilter translates it into an application-task predicate.
export const ACTION_REQUIRED_STATUS_FILTER = 'ACTION_REQUIRED'

export const PROJECT_TYPES = {
  EXEMPTION: 'EXEMPTION',
  MARINE_LICENCE: 'MARINE_LICENCE'
}
