import { createHash } from 'node:crypto'

// Only geometry fields — renaming a site or editing activity details must not re-trigger the policy job.
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
  return JSON.stringify(value)
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

// Responses survive a geometry change so existing results are available if a re-trigger
// produces the same job — except when all sites are removed, which also clears responses.
export const buildPolicyResetFields = (id, existing, newSiteDetails) => {
  if (!existing?.marinePlanPolicyJobId) {
    return {}
  }
  if (
    computePolicyJobId(id, existing.siteDetails) ===
    computePolicyJobId(id, newSiteDetails)
  ) {
    return {}
  }
  return {
    marinePlanPolicyJob: null,
    marinePlanPolicyJobId: null,
    marinePlanPolicies: [],
    marinePlanPoliciesCount: 0,
    ...(newSiteDetails.length === 0 && {
      marinePlanPolicyResponses: {},
      marinePlanPolicyResponseCount: 0
    })
  }
}
