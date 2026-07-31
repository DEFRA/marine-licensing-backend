import { buffer, simplify } from '@turf/turf'
import {
  collectionMarinePlanAreas,
  collectionMarinePlanAreasSimplified
} from '../../common/constants/db-collections.js'
import { structureErrorForECS } from '../../common/helpers/logging/logger.js'

/**
 * This tolerance is encoded in the collection name
 * (0.001 → 'marine-plan-areas-simple-0001', db-collections.js). Change them
 * ONLY together, dropping the old collection in the same change.
 *
 * 0.001° ≈ 111m of latitude — the simplified boundary deviates from the true
 * boundary by at most about that, far inside the ~2.4km plan-boundary data
 * inaccuracy that motivates the fallback. Simplification cuts the areas from
 * ~834k vertices to ~18k, which is what makes the per-vertex $geoNear
 * fallback query fast (measured 73.6s → sub-second).
 * Algorithm: https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm
 */
export const MARINE_PLAN_AREA_SIMPLIFY_TOLERANCE_DEGREES = 0.001

const simplifyFeature = (doc, logger) => {
  const feature = {
    type: 'Feature',
    properties: doc.properties ?? {},
    geometry: doc.geometry
  }
  try {
    const simplified = simplify(feature, {
      tolerance: MARINE_PLAN_AREA_SIMPLIFY_TOLERANCE_DEGREES,
      // Pure Douglas–Peucker (no radial pre-filter): every removed point is
      // guaranteed to deviate less than the tolerance from the kept boundary.
      // Costs ~30ms more, once, at startup.
      highQuality: true,
      mutate: false
    })
    // Same normalisation the loader applies (geo-transforms.js): a zero-width
    // buffer rebuilds the geometry, resolving any self-intersections that
    // simplification introduces — MongoDB's 2dsphere index rejects them.
    return buffer(simplified, 0).geometry
  } catch (error) {
    logger.warn(
      structureErrorForECS(error),
      `Simplification failed for marine plan area ${doc.name}; keeping full-fidelity geometry`
    )
    return doc.geometry
  }
}

export const buildSimplifiedMarinePlanAreas = async (db, logger) => {
  const source = await db
    .collection(collectionMarinePlanAreas)
    .find({})
    .toArray()

  if (!source.length) {
    logger.warn(
      `Cannot build ${collectionMarinePlanAreasSimplified}: ${collectionMarinePlanAreas} is empty — the nearest-area fallback will not run`
    )
    return 0
  }

  const simplified = source.map((doc) => ({
    type: 'Feature',
    name: doc.name,
    geometry: simplifyFeature(doc, logger),
    properties: doc.properties
  }))

  const target = db.collection(collectionMarinePlanAreasSimplified)
  await target.deleteMany({})
  await target.insertMany(simplified)
  await target.createIndex({ geometry: '2dsphere' })

  logger.info(
    `Built ${collectionMarinePlanAreasSimplified} with ${simplified.length} simplified marine plan areas`
  )
  return simplified.length
}

export const simplifyMarinePlanAreasPlugin = {
  plugin: {
    name: 'simplify-marine-plan-areas',
    register: async (server) => {
      try {
        await buildSimplifiedMarinePlanAreas(server.db, server.logger)
      } catch (error) {
        // Non-fatal, matching populate-geo-areas.js: the app starts, the
        // fallback just cannot run (sites then take the zero-policy path).
        server.logger.error(
          structureErrorForECS(error),
          'Failed to build simplified marine plan areas'
        )
      }
    }
  }
}
