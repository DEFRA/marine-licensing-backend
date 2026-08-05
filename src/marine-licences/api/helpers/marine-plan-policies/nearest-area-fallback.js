import {
  LAND_POLICY_CODE,
  MARINE_PLAN_POLICY_EVENT_ACTION
} from '../../../constants/marine-licence.js'
import { queryNonSpatialPolicies } from './arcgis-client.js'
import { findNearestMarinePlanArea } from './nearest-marine-plan-area.js'
import {
  derivePolicyCodePrefix,
  filterPoliciesByPrefixes
} from './region-prefix.js'

// Application-level trigger — the combined intersect query found
// nothing (or only the onshore 'Land' policy). Evaluated only on successful
// queries; failures keep the existing SQS retry path.
export const shouldRunNearestAreaFallback = (policies) =>
  policies.every((policy) => policy.policyCode === LAND_POLICY_CODE)

const warnEvent = (logger, action, outcome, reference, reason, message) =>
  logger.warn({ event: { action, outcome, reference, reason } }, message)

/**
 * Nearest-area fallback: per site, find the nearest marine plan area by edge
 * distance (nearest-marine-plan-area.js), derive its policy-code prefix
 * (region-prefix.js), and assign the matching NON-spatial policies from
 * ArcGIS. Spatial policies cannot apply to a site outside the area. The
 * returned list replaces a triggering Land-only result entirely and
 * flows through the standard wording/persistence pipeline unchanged.
 */
export const runNearestAreaFallback = async ({
  db,
  siteDetails,
  licenceId,
  logger
}) => {
  const siteAreas = []
  // Sequential by design: each lookup is up to ~1.5s of $geoNear work, and
  // running sites concurrently would contend for the same index.
  for (const site of siteDetails ?? []) {
    const nearest = await findNearestMarinePlanArea({ db, site, logger })
    if (nearest) {
      siteAreas.push(nearest)
    }
  }

  if (!siteAreas.length) {
    // Cannot run — e.g. no site had usable geometry, or the simplified
    // areas collection is missing or empty. Fall through to zero-policy
    // behaviour, visibly.
    warnEvent(
      logger,
      MARINE_PLAN_POLICY_EVENT_ACTION.NEAREST_AREA_CANNOT_RUN,
      'failure',
      licenceId,
      'No site yielded a nearest marine plan area; the licence may have no usable site geometry, or the simplified marine plan areas collection may be missing or empty (check it)',
      `Nearest-area fallback could not run for licence ${licenceId}; completing with zero policies`
    )
    return []
  }

  const prefixes = [
    ...new Set(siteAreas.map((area) => derivePolicyCodePrefix(area.regionref)))
  ]

  const nonSpatial = await queryNonSpatialPolicies({ licenceId, logger })
  const { policies, unmatchedPrefixes } = filterPoliciesByPrefixes(
    nonSpatial,
    prefixes
  )

  for (const prefix of unmatchedPrefixes) {
    // Residual guard: the regionref/policy-code naming convention drifted.
    warnEvent(
      logger,
      MARINE_PLAN_POLICY_EVENT_ACTION.REGION_PREFIX_NO_MATCH,
      'failure',
      `${licenceId} prefix=${prefix}`,
      'A derived policy-code prefix matched no non-spatial policies; report the regionref/policy-code mismatch to the data owners',
      `No non-spatial policies matched prefix ${prefix} for licence ${licenceId}`
    )
  }

  // This warn IS the provenance record (and a data-quality signal about
  // the plan-area boundaries) — nothing is persisted about the fallback.
  // Site coverage is included because findNearestMarinePlanArea can return
  // null for an individual site (e.g. unusable geometry) without the whole
  // fallback failing, so a partial result must be distinguishable from a
  // full one from this one line.
  // siteDetails is guaranteed non-empty here: siteAreas.length > 0 only if at
  // least one entry of `siteDetails ?? []` produced a result above.
  const siteCoverage = `${siteAreas.length}/${siteDetails.length} sites`
  const siteSummary = siteAreas
    .map(
      (area) =>
        `area: ${area.regionref}, distance: ${Math.round(area.distanceMetres)}m`
    )
    .join('; ')
  warnEvent(
    logger,
    MARINE_PLAN_POLICY_EVENT_ACTION.NEAREST_AREA_FALLBACK,
    'success',
    `${licenceId} ${siteCoverage} ${siteSummary}`,
    'Policy assignment was delegated to the nearest marine plan area because the intersect query returned none; this may indicate plan-area boundary inaccuracy near these sites',
    `Nearest-area fallback assigned ${policies.length} non-spatial policies for licence ${licenceId} (${siteSummary})`
  )

  return policies
}
