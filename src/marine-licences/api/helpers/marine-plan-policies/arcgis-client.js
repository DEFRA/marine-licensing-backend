import { config } from '../../../../config.js'
import { buildEmpGeometries } from '../../../../shared/common/helpers/emp/transforms/site-details.js'
import { MARINE_PLAN_POLICY_EVENT_ACTION } from '../../../constants/marine-licence.js'
import { timedJsonFetch } from './policy-http.js'

// Field names come from the PolicyData_MDP ArcGIS layer schema.
const extractPolicy = (attributes = {}) => {
  const { PolicyCode, Sector } = attributes
  if (!PolicyCode) {
    return null
  }
  return {
    policyCode: String(PolicyCode),
    sector: Sector ? String(Sector) : null
  }
}

export const queryArcGISPolicies = async ({
  siteDetails,
  licenceId,
  logger
}) => {
  const { arcgisUrl, arcgisTimeoutMs } = config.get('marinePlanPolicies')
  const geometries = buildEmpGeometries(siteDetails)

  if (!geometries.length) {
    return []
  }

  const combinedGeometry = {
    rings: geometries.flatMap((g) => g.rings),
    spatialReference: geometries[0].spatialReference
  }

  const json = await timedJsonFetch({
    url: `${arcgisUrl}/query`,
    options: {
      method: 'POST',
      body: new URLSearchParams({
        f: 'json',
        geometry: JSON.stringify(combinedGeometry),
        geometryType: 'esriGeometryPolygon',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: 'PolicyCode,Sector',
        returnGeometry: 'false'
      }).toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded' }
    },
    timeoutMs: arcgisTimeoutMs,
    eventAction: MARINE_PLAN_POLICY_EVENT_ACTION.ARCGIS_QUERY,
    upstreamName: 'ArcGIS feature-server query',
    logger,
    reference: licenceId
  })

  // ArcGIS reports failures inside a 200 response body
  if (json.error) {
    throw new Error(
      `ArcGIS feature-server query returned error ${json.error.code}: ${json.error.message}`
    )
  }

  const policiesByCode = new Map()
  for (const feature of json.features ?? []) {
    const policy = extractPolicy(feature.attributes)
    if (policy) {
      policiesByCode.set(policy.policyCode, policy)
    }
  }
  return [...policiesByCode.values()]
}
