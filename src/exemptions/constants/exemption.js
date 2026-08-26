export const EXEMPTION_STATUS = {
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  SUBMITTED: 'SUBMITTED',
  WITHDRAWN: 'WITHDRAWN'
}

export const EXEMPTION_STATUS_LABEL = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  Closed: 'Active',
  SUBMITTED: 'Submitted',
  WITHDRAWN: 'Withdrawn'
}

// Every status an exemption holds once submitted and before it is withdrawn.
// Consumers that meant "submitted" by testing for ACTIVE test against this.
export const SUBMITTED_STATUSES = [
  EXEMPTION_STATUS.SCHEDULED,
  EXEMPTION_STATUS.ACTIVE,
  EXEMPTION_STATUS.EXPIRED
]

// An activity that has already ended cannot be withdrawn.
export const WITHDRAWABLE_STATUSES = [
  EXEMPTION_STATUS.SCHEDULED,
  EXEMPTION_STATUS.ACTIVE
]

export const EXEMPTION_TYPE = {
  EXEMPT_ACTIVITY: 'EXEMPT_ACTIVITY'
}
