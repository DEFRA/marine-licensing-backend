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

const stableStringify = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort()
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

/**
 * Computes the dedupe key for a policy-calculation job: a SHA-256 of the
 * licence id plus the sorted site geometries. Sorting makes the hash
 * insensitive to site order; extracting geometry fields makes it insensitive
 * to non-spatial edits (site names, activity details).
 */
export const computePolicyJobId = (licenceId, siteDetails = []) => {
  const sortedGeometries = siteDetails
    .map((site) => stableStringify(extractSiteGeometry(site)))
    .sort()

  return createHash('sha256')
    .update(`${licenceId}:${sortedGeometries.join('|')}`)
    .digest('hex')
}
