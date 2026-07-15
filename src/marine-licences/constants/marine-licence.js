export const MARINE_LICENCE_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  SUBMITTED: 'SUBMITTED'
}

export const MARINE_LICENCE_STATUS_LABEL = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  SUBMITTED: 'Submitted'
}

export const MARINE_PLAN_POLICY_JOB_STATUS = {
  PENDING: 'pending',
  COMPUTING: 'computing',
  READY: 'ready',
  FAILED: 'failed'
}

// The five wording fields of a marine plan policy, in canonical order.
export const MARINE_PLAN_POLICY_CONTENT_FIELDS = [
  'policy',
  'policyAim',
  'whatIsIt',
  'whyIsItImportant',
  'howWillThisBeImplemented'
]

export const MARINE_PLAN_POLICY_EVENT_ACTION = {
  JOB_STALE: 'mp-policies:job-stale',
  JOB_FAILED: 'mp-policies:job-failed',
  JOB_COMPLETE: 'mp-policies:job-complete',
  ARCGIS_QUERY: 'mp-policies:arcgis-query',
  WORDING_FETCH: 'mp-policies:wording-fetch'
}
