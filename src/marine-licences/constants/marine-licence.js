export const MARINE_LICENCE_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
  SUBMITTED: 'SUBMITTED',
  TRANSFERRED: 'TRANSFERRED',
  WITHDRAWN: 'WITHDRAWN'
}

export const MARINE_LICENCE_STATUS_LABEL = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  REJECTED: 'Rejected',
  SUBMITTED: 'Submitted',
  TRANSFERRED: 'Transferred',
  WITHDRAWN: 'Withdrawn'
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
  ARCGIS_NONSPATIAL_QUERY: 'mp-policies:arcgis-nonspatial-query',
  NEAREST_AREA_FALLBACK: 'mp-policies:nearest-area-fallback',
  NEAREST_AREA_CANNOT_RUN: 'mp-policies:nearest-area-cannot-run',
  NEAREST_AREA_UNAVAILABLE: 'mp-policies:nearest-area-unavailable',
  SITE_GEOMETRY_INVALID: 'mp-policies:site-geometry-invalid',
  REGION_PREFIX_NO_MATCH: 'mp-policies:region-prefix-no-match',
  WORDING_FETCH: 'mp-policies:wording-fetch',
  WORDING_ENTRY_SKIPPED: 'mp-policies:wording-entry-skipped',
  WORDING_FIELD_INVALID: 'mp-policies:wording-field-invalid',
  WORDING_FIELD_TOO_LARGE: 'mp-policies:wording-field-too-large'
}

// PolicyCode the ArcGIS layer returns for onshore locations.
export const LAND_POLICY_CODE = 'Land'

export const MAS_EVENT_ACTION = {
  MESSAGE_RECEIVED: 'mas:message-received',
  MESSAGE_DEAD_LETTERED: 'mas:message-dead-lettered',
  JOB_STALE: 'mas:job-stale',
  JOB_FAILED: 'mas:job-failed',
  JOB_COMPLETE: 'mas:job-complete'
}
