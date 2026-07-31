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
  policies.length === 0 ||
  policies.every((policy) => policy.policyCode === LAND_POLICY_CODE)

const warnEvent = (logger, action, reference, reason, message) =>
  logger.warn({ event: { action, reference, reason } }, message)

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
  for (const site of siteDetails ?? []) {
    const nearest = await findNearestMarinePlanArea({ db, site, logger })
    if (nearest) {
      siteAreas.push(nearest)
    }
  }

  if (!siteAreas.length) {
    // Cannot run — e.g. the simplified areas collection is
    // empty. Fall through to today's zero-policy behaviour, visibly.
    warnEvent(
      logger,
      MARINE_PLAN_POLICY_EVENT_ACTION.NEAREST_AREA_CANNOT_RUN,
      licenceId,
      'No nearest marine plan area could be determined for any site; check the marine-plan-areas-simple-0001 collection is populated',
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
      `${licenceId} prefix=${prefix}`,
      'A derived policy-code prefix matched no non-spatial policies; report the regionref/policy-code mismatch to the data owners',
      `No non-spatial policies matched prefix ${prefix} for licence ${licenceId}`
    )
  }

  // This warn IS the provenance record (and a data-quality signal about
  // the plan-area boundaries) — nothing is persisted about the fallback.
  const siteSummary = siteAreas
    .map((area) => `${area.regionref}@${Math.round(area.distanceMetres)}m`)
    .join(' ')
  warnEvent(
    logger,
    MARINE_PLAN_POLICY_EVENT_ACTION.NEAREST_AREA_FALLBACK,
    `${licenceId} ${siteSummary}`,
    'Policies were derived from the nearest marine plan area because the intersect query returned none; this may indicate plan-area boundary inaccuracy near these sites',
    `Nearest-area fallback assigned ${policies.length} non-spatial policies for licence ${licenceId} (${siteSummary})`
  )

  return policies
}
