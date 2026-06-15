import { createHash } from 'node:crypto'

// Only fields that affect which marine plan policies apply. Renaming a site or
// editing activity details must not change the hash, so the policy job is only
// re-triggered when the geometry genuinely changes.
const GEOMETRY_FIELDS = [
  'coordinatesType',
  'coordinatesEntry',
  'coordinateSystem',
  'coordinates',
  'circleWidth',
  'geoJSON'
]

const compareStrings = (a, b) => a.localeCompare(b)

const stableStringify = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort(compareStrings)
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

const extractSiteGeometry = (site) =>
  GEOMETRY_FIELDS.reduce((geometry, field) => {
    if (site?.[field] !== undefined) {
      geometry[field] = site[field]
    }
    return geometry
  }, {})

export const computePolicyJobId = (licenceId, siteDetails = []) => {
  const sortedGeometries = siteDetails
    .map((site) => stableStringify(extractSiteGeometry(site)))
    .sort(compareStrings)

  return createHash('sha256')
    .update(`${licenceId}:${sortedGeometries.join('|')}`)
    .digest('hex')
}

// marinePlanPolicyResponses are deliberately never reset — only policy job state is discarded on geometry change.
export const buildPolicyResetFields = (id, existing, newSiteDetails) => {
  if (!existing?.marinePlanPolicyJobId) {
    return {}
  }
  const newPolicyJobId = computePolicyJobId(id, newSiteDetails)
  if (existing.marinePlanPolicyJobId === newPolicyJobId) {
    return {}
  }
  return {
    marinePlanPolicyJob: null,
    marinePlanPolicyJobId: null,
    marinePlanPolicyJobQueuedAt: null,
    marinePlanPolicies: []
  }
}
