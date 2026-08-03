import { buffer, simplify } from '@turf/turf'
import {
  collectionMarinePlanAreas,
  collectionMarinePlanAreasSimplified
} from '../../common/constants/db-collections.js'
import { structureErrorForECS } from '../../common/helpers/logging/logger.js'

/**
 * The tolerance value is encoded in the collection name
 * (0.001 → 'marine-plan-areas-simple-0001', db-collections.js). The
 * tolerance and the collection name change ONLY together, dropping the old
 * collection in the same change.
 *
 * 0.001° ≈ 111m of latitude — the simplified boundary deviates from the true
 * boundary by at most about that, far inside the ~2.4km plan-boundary data
 * inaccuracy that motivates the fallback. Simplification cuts the areas from
 * ~834k vertices to ~18k, which is what makes the per-vertex $geoNear
 * fallback query fast (measured 73.6s → sub-second).
 * Algorithm: https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm
 */
const MARINE_PLAN_AREA_SIMPLIFY_TOLERANCE_DEGREES = 0.001

const SIMPLIFY_LOCK_KEY = 'simplify-marine-plan-areas'

// Scratch namespace the rebuild writes into before the atomic swap below.
// Derived from the live name (never hardcoded) so the two can never drift.
const SCRATCH_COLLECTION = `${collectionMarinePlanAreasSimplified}-build`

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
    const buffered = buffer(simplified, 0)

    if (!buffered?.geometry) {
      logger.warn(
        `Zero-width buffer collapsed the geometry for marine plan area ${doc.name}; keeping full-fidelity geometry`
      )
      return { geometry: doc.geometry, keptFullFidelity: true }
    }

    return { geometry: buffered.geometry, keptFullFidelity: false }
  } catch (error) {
    logger.warn(
      structureErrorForECS(error),
      `Simplification failed for marine plan area ${doc.name}; keeping full-fidelity geometry`
    )
    return { geometry: doc.geometry, keptFullFidelity: true }
  }
}

export const buildSimplifiedMarinePlanAreas = async (db, logger) => {
  const source = await db
    .collection(collectionMarinePlanAreas)
    .find({})
    .toArray()

  if (!source.length) {
    logger.warn(
      `Cannot rebuild ${collectionMarinePlanAreasSimplified}: ${collectionMarinePlanAreas} is empty — leaving any existing simplified collection untouched`
    )
    return 0
  }

  let keptFullFidelityCount = 0

  const simplified = source.map((doc) => {
    const { geometry, keptFullFidelity } = simplifyFeature(doc, logger)
    if (keptFullFidelity) {
      keptFullFidelityCount += 1
    }
    return {
      type: 'Feature',
      name: doc.name,
      geometry,
      properties: doc.properties ?? {}
    }
  })

  // Build into a scratch collection, then swap it in with an atomic rename
  // (below), rather than clearing and repopulating the live collection in
  // place. That would leave a window — visible to another instance's
  // in-flight policy lookup — where marine-plan-areas-simple-0001 is empty or
  // not yet 2dsphere-indexed, and a build that fails partway would leave a
  // truncated collection that still looks healthy. Neither can happen here:
  // the live collection is untouched until the rename, and a failure before
  // it throws with the live collection exactly as it was.
  //
  // dropCollection resolves to false for a namespace that does not exist
  // rather than throwing (node_modules/mongodb/lib/operations/drop.js), so
  // this also clears any scratch collection abandoned by a previous build
  // that crashed before reaching the rename.
  await db.dropCollection(SCRATCH_COLLECTION)
  const scratch = db.collection(SCRATCH_COLLECTION)
  await scratch.insertMany(simplified)
  await scratch.createIndex({ geometry: '2dsphere' })

  // A same-database renameCollection is a namespace-only swap done under an
  // exclusive lock, not a document-by-document copy, so it is effectively
  // instantaneous: a reader sees either the complete previous collection or
  // the complete new one, never a gap. dropTarget replaces the previous
  // build in the same operation; MongoDB documents dropTarget as a no-op
  // when the target does not exist (true on the very first-ever run), so no
  // special-casing is needed here — confirmed empirically in this file's
  // tests too.
  // https://www.mongodb.com/docs/manual/reference/command/renameCollection/
  await db.renameCollection(
    SCRATCH_COLLECTION,
    collectionMarinePlanAreasSimplified,
    { dropTarget: true }
  )

  if (keptFullFidelityCount > 0) {
    const simplifiedCount = simplified.length - keptFullFidelityCount
    logger.warn(
      `Built ${collectionMarinePlanAreasSimplified} with ${simplified.length} marine plan areas: ${simplifiedCount} simplified, ${keptFullFidelityCount} kept at full fidelity after simplification failures`
    )
  } else {
    logger.info(
      `Built ${collectionMarinePlanAreasSimplified} with ${simplified.length} simplified marine plan areas`
    )
  }

  return simplified.length
}

export const simplifyMarinePlanAreasPlugin = {
  plugin: {
    name: 'simplify-marine-plan-areas',
    register: async (server) => {
      let lock

      try {
        lock = await server.locker.lock(SIMPLIFY_LOCK_KEY)

        if (!lock) {
          server.logger.info(
            'Another instance is already rebuilding the simplified marine plan areas collection; skipping'
          )
          return
        }

        await buildSimplifiedMarinePlanAreas(server.db, server.logger)
      } catch (error) {
        // Non-fatal, matching populate-geo-areas.js: the app starts, the
        // fallback just cannot run (sites then take the zero-policy path).
        // Covers both a failed build and a failed/erroring lock acquisition
        // (e.g. a Mongo write timeout, as opposed to mongo-locks' own
        // duplicate-key "already locked" case, which resolves to null above).
        server.logger.error(
          structureErrorForECS(error),
          'Failed to build simplified marine plan areas'
        )
      } finally {
        if (lock) {
          try {
            await lock.free()
          } catch (error) {
            server.logger.error(
              structureErrorForECS(error),
              'Failed to release simplify-marine-plan-areas lock'
            )
          }
        }
      }
    }
  }
}
