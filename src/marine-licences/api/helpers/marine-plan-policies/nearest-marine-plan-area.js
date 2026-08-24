import { config } from '../../../../config.js'
import { collectionMarinePlanAreasSimplified } from '../../../../shared/common/constants/db-collections.js'
import {
  MONGO_INDEX_NOT_FOUND_CODE,
  MONGO_NAMESPACE_NOT_FOUND_CODE,
  MONGO_NO_QUERY_EXECUTION_PLANS_CODE
} from '../../../../shared/common/constants/mongo.js'
import {
  convertMultipleCoordinates,
  convertSingleCoordinates,
  formatFileCoordinates
} from '../../../../shared/common/helpers/geo/geo-parse.js'
import { structureErrorForECS } from '../../../../shared/common/helpers/logging/logger.js'
import { MARINE_PLAN_POLICY_EVENT_ACTION } from '../../../constants/marine-licence.js'
import {
  calculateSiteDiameterMetres,
  collectSiteVertices
} from './site-vertices.js'

const MAX_LONGITUDE = 180
const MAX_LATITUDE = 90
const NANOSECONDS_PER_MILLISECOND = 1_000_000

// Every way the simplified collection can be unusable rather than merely
// empty: never built (the source collection was empty at startup), or its
// 2dsphere index missing or on the wrong field (a rebuild died between
// inserting the areas and creating the index). All mean the fallback is
// permanently misconfigured, so retrying cannot fix them: they take the
// cannot-run path instead of consuming the queue's delivery attempts and
// dead-lettering the job. An empty but correctly indexed collection is not
// an error at all — it simply returns no rows.
const CANNOT_RUN_ERROR_CODES = new Set([
  MONGO_NAMESPACE_NOT_FOUND_CODE,
  MONGO_INDEX_NOT_FOUND_CODE,
  MONGO_NO_QUERY_EXECUTION_PLANS_CODE
])

const siteToGeometries = (site) => {
  const { coordinatesType, coordinatesEntry } = site
  if (coordinatesType === 'coordinates' && coordinatesEntry === 'single') {
    return [convertSingleCoordinates(site)]
  }
  if (coordinatesType === 'coordinates' && coordinatesEntry === 'multiple') {
    return convertMultipleCoordinates(site)
  }
  return formatFileCoordinates(site)
}

const warnSiteGeometryInvalid = ({ logger, site, error, message }) =>
  logger.warn(
    {
      ...structureErrorForECS(error),
      event: {
        action: MARINE_PLAN_POLICY_EVENT_ACTION.SITE_GEOMETRY_INVALID,
        outcome: 'failure',
        reference: site.siteName ?? 'unknown site',
        reason:
          'Site geometry could not be turned into query vertices; the site is skipped by the nearest-area lookup — check the stored site geometry'
      }
    },
    message
  )

/**
 * Self-derived search bound. NOT a distance cap: nothing is
 * ever excluded from the result, however far the nearest area turns out to be.
 * Up to 5.5x speedup
 */
export const deriveNearestAreaSearchBound = ({
  anchorDistanceMetres,
  siteDiameterMetres
}) => anchorDistanceMetres + siteDiameterMetres

// `near` must be the GeoJSON point form. A bare coordinate array is the legacy
// form, which still runs but reports distances in RADIANS — silently returning
// numbers orders of magnitude too small rather than raising an error.
const geoNearStage = (near, maxDistance) => ({
  $geoNear: {
    near,
    // Naming the key removes two silent misconfiguration paths: with two
    // 2dsphere indexes $geoNear hard-fails as unsure which to use, and with an
    // index on a different field it quietly returns no rows, which would be
    // misreported as cannot-run.
    key: 'geometry',
    distanceField: 'distanceMetres',
    spherical: true,
    ...(maxDistance === undefined ? {} : { maxDistance })
  }
})

// Phase 1: single unbounded $geoNear from one vertex — both the anchor for the
// search bound and the cannot-run detector. Null means the fallback cannot
// produce an answer: either the collection holds no areas, or the collection
// or its geo index is missing entirely (see CANNOT_RUN_ERROR_CODES).
const nearestAreaToPoint = async ({ db, coordinates, logger }) => {
  try {
    const [nearest] = await db
      .collection(collectionMarinePlanAreasSimplified)
      .aggregate([
        geoNearStage({ type: 'Point', coordinates }),
        { $limit: 1 },
        { $project: { distanceMetres: 1 } }
      ])
      .toArray()
    return nearest ?? null
  } catch (error) {
    // Anything else is genuinely transient and must stay retryable.
    if (!CANNOT_RUN_ERROR_CODES.has(error.code)) {
      throw error
    }
    logger.warn(
      {
        ...structureErrorForECS(error),
        event: {
          action: MARINE_PLAN_POLICY_EVENT_ACTION.NEAREST_AREA_UNAVAILABLE,
          outcome: 'failure',
          reference: collectionMarinePlanAreasSimplified,
          reason:
            'The simplified marine plan areas collection or its 2dsphere index is missing; check whether the startup rebuild succeeded'
        }
      },
      `Nearest marine plan area query cannot run against ${collectionMarinePlanAreasSimplified}`
    )
    return null
  }
}

// Phase 2: one document per site vertex, each looks up its nearest area, and
// the closest vertex-area pair wins — i.e. the area nearest to any point on
// the site's (densified) edge.
const perVertexNearestPipeline = (vertices, searchBound) => [
  { $documents: vertices.map((coords) => ({ coords })) },
  {
    $lookup: {
      from: collectionMarinePlanAreasSimplified,
      let: { pt: '$coords' },
      pipeline: [
        geoNearStage({ type: 'Point', coordinates: '$$pt' }, searchBound),
        { $limit: 1 },
        {
          $project: {
            name: 1,
            regionref: '$properties.regionref',
            distanceMetres: 1
          }
        }
      ],
      as: 'nearest'
    }
  },
  { $unwind: '$nearest' },
  // Equal distances are real — mirrored areas can return bit-identical doubles
  // — and MongoDB documents no sort stability, so regionref breaks the tie
  // deterministically rather than letting an arbitrary policy prefix win.
  { $sort: { 'nearest.distanceMetres': 1, 'nearest.regionref': 1 } },
  { $limit: 1 },
  {
    $project: {
      _id: 0,
      name: '$nearest.name',
      regionref: '$nearest.regionref',
      distanceMetres: '$nearest.distanceMetres'
    }
  }
]

// Tested with Number.isFinite and abs rather than range comparisons so that
// null, NaN and Infinity all fail closed: comparisons against null are false
// on BOTH sides, so a null ordinate would otherwise pass as in-range and only
// surface as a $geoNear error.
const outOfRangeVertex = (vertices) =>
  vertices.find(
    ([longitude, latitude]) =>
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      Math.abs(longitude) > MAX_LONGITUDE ||
      Math.abs(latitude) > MAX_LATITUDE
  )

/**
 * Every geometry computation the query depends on, in one synchronous guarded
 * block. A stored geometry can be malformed in ways the upstream converters
 * wave through — an empty `coordinates` array is truthy, so it survives the
 * file-feature filter and then makes turf throw — and an unhandled throw here
 * would reach the queue worker as a transient failure, burning every delivery
 * attempt before the job is dead-lettered. Degrading to null instead routes it
 * to the visible cannot-run path.
 *
 * The database calls deliberately stay OUTSIDE this catch: a Mongo failure is
 * genuinely transient and must keep propagating so it can be retried, rather
 * than being recorded as a permanently unusable site.
 */
const deriveSiteQueryGeometry = (site, logger) => {
  try {
    const geometries = siteToGeometries(site)
    if (!geometries.length) {
      return null
    }

    const { nearestAreaMaxVertexSpacingMetres, nearestAreaMaxVerticesPerSite } =
      config.get('marinePlanPolicies')
    const vertices = collectSiteVertices(geometries, {
      maxSpacingMetres: nearestAreaMaxVertexSpacingMetres,
      maxVertices: nearestAreaMaxVerticesPerSite
    })
    // Some empty-but-valid geometries (an empty MultiPolygon) convert without
    // error yet leave nothing to query from.
    if (!vertices.length) {
      return null
    }

    // Turf happily densifies coordinates outside the valid longitude/latitude
    // range — a site stored in eastings and northings, say — and $geoNear then
    // rejects them with a BadValue error naming neither the site nor the
    // offending coordinate. Failing here keeps the diagnosis in one place.
    const outOfRange = outOfRangeVertex(vertices)
    if (outOfRange) {
      warnSiteGeometryInvalid({
        logger,
        site,
        message: `Site geometry has a coordinate outside the valid longitude/latitude range [${outOfRange}], skipping site in nearest marine plan area query`
      })
      return null
    }

    return { vertices, diameterMetres: calculateSiteDiameterMetres(geometries) }
  } catch (error) {
    warnSiteGeometryInvalid({
      logger,
      site,
      error,
      message:
        'Site geometry could not be converted to vertices, skipping site in nearest marine plan area query'
    })
    return null
  }
}

const logQueryDuration = ({
  logger,
  site,
  licenceId,
  vertexCount,
  startedAt,
  nearest
}) => {
  const durationNs = Number(process.hrtime.bigint() - startedAt)
  const durationMs = Math.round(durationNs / NANOSECONDS_PER_MILLISECOND)
  const siteName = site.siteName ?? 'unknown site'
  const distance = nearest
    ? `${Math.round(nearest.distanceMetres)}m`
    : 'no area found'

  logger.info(
    {
      event: {
        action: MARINE_PLAN_POLICY_EVENT_ACTION.NEAREST_AREA_QUERY,
        outcome: nearest ? 'success' : 'failure',
        duration: durationNs,
        reference: `${licenceId ?? 'unknown licence'} site: ${siteName}, vertices: ${vertexCount}`
      }
    },
    `Nearest marine plan area query for site ${siteName} completed in ${durationMs}ms (${vertexCount} vertices, ${distance})`
  )
}

// applySearchBound exists only so tests can prove that equivalence.
export const findNearestMarinePlanArea = async ({
  db,
  site,
  logger,
  licenceId,
  applySearchBound = true
}) => {
  const queryGeometry = deriveSiteQueryGeometry(site, logger)
  if (!queryGeometry) {
    return null
  }
  const { vertices, diameterMetres } = queryGeometry
  const startedAt = process.hrtime.bigint()
  const logDuration = (nearestArea) =>
    logQueryDuration({
      logger,
      site,
      licenceId,
      vertexCount: vertices.length,
      startedAt,
      nearest: nearestArea
    })

  const anchor = await nearestAreaToPoint({
    db,
    coordinates: vertices[0],
    logger
  })
  if (!anchor) {
    logDuration(null)
    return null
  }

  const searchBound = applySearchBound
    ? deriveNearestAreaSearchBound({
        anchorDistanceMetres: anchor.distanceMetres,
        siteDiameterMetres: diameterMetres
      })
    : undefined

  const [nearest] = await db
    .aggregate(perVertexNearestPipeline(vertices, searchBound))
    .toArray()
  logDuration(nearest ?? null)
  return nearest ?? null
}
