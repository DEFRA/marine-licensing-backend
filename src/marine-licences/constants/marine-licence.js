export const MARINE_LICENCE_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
  SUBMITTED: 'SUBMITTED',
  TRANSFERRED: 'TRANSFERRED',
  WITHDRAWN: 'WITHDRAWN',
  // Masks the lifecycle status while an application task is outstanding; the masked
  // value is kept in previousStatus (see api/helpers/lifecycle-status.js).
  ACTION_REQUIRED: 'ACTION_REQUIRED'
}

export const MARINE_LICENCE_STATUS_LABEL = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  REJECTED: 'Rejected',
  SUBMITTED: 'Submitted',
  TRANSFERRED: 'Transferred',
  WITHDRAWN: 'Withdrawn',
  ACTION_REQUIRED: 'Action required'
}

export const APPLICATION_TASK_TYPE = {
  WITHHOLDING_NOTIFICATION: 'WITHHOLDING_NOTIFICATION'
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
  NEAREST_AREA_QUERY: 'mp-policies:nearest-area-query',
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
  JOB_COMPLETE: 'mas:job-complete',
  APPLICATION_TASK_ADDED: 'mas:application-task-added',
  APPLICATION_TASK_DUPLICATE: 'mas:application-task-duplicate',
  APPLICATION_TASK_REDELIVERED: 'mas:application-task-redelivered',
  APPLICATION_TASK_SKIPPED: 'mas:application-task-skipped',
  LICENCE_NOT_FOUND: 'mas:licence-not-found'
}
