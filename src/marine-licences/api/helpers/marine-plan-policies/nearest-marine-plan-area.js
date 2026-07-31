import { config } from '../../../../config.js'
import { collectionMarinePlanAreasSimplified } from '../../../../shared/common/constants/db-collections.js'
import {
  convertMultipleCoordinates,
  convertSingleCoordinates,
  formatFileCoordinates
} from '../../../../shared/common/helpers/geo/geo-parse.js'
import { structureErrorForECS } from '../../../../shared/common/helpers/logging/logger.js'
import { collectSiteVertices, siteDiameterMetres } from './site-vertices.js'

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

/**
 * Self-derived search bound. NOT a distance cap: nothing is
 * ever excluded from the result, however far the nearest area turns out to be.
 *
 * Phase 1 proves an area exists at `anchorDistanceMetres` from one vertex.
 * Every other vertex is at most `siteDiameterMetres` from that vertex, so
 * that same area is within (anchor + diameter) of EVERY vertex — by the
 * triangle inequality each vertex's true nearest area must lie inside that
 * radius, so telling $geoNear to stop looking there provably cannot change
 * any result. It only spares the index expanding across empty ocean
 * (measured 5.5x).
 *
 * References: https://en.wikipedia.org/wiki/Triangle_inequality
 *             https://en.wikipedia.org/wiki/Branch_and_bound
 *             https://www.mongodb.com/docs/manual/reference/operator/aggregation/geoNear/
 */
export const deriveNearestAreaSearchBound = ({
  anchorDistanceMetres,
  siteDiameterMetres
}) => anchorDistanceMetres + siteDiameterMetres

const geoNearStage = (near, maxDistance) => ({
  $geoNear: {
    near,
    distanceField: 'distanceMetres',
    spherical: true,
    ...(maxDistance === undefined ? {} : { maxDistance })
  }
})

// Phase 1: single unbounded $geoNear from one vertex — both the bound anchor
// and the cannot-run detector (null ⇔ the simplified collection is empty).
const nearestAreaToPoint = async (db, coordinates) => {
  const [nearest] = await db
    .collection(collectionMarinePlanAreasSimplified)
    .aggregate([
      geoNearStage({ type: 'Point', coordinates }),
      { $limit: 1 },
      { $project: { distanceMetres: 1 } }
    ])
    .toArray()
  return nearest ?? null
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
  { $sort: { 'nearest.distanceMetres': 1 } },
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

/**
 * Every geometry computation the query depends on, in one synchronous guarded
 * block. A stored geometry can be malformed in ways the upstream converters
 * wave through — an empty `coordinates` array is truthy, so it survives the
 * file-feature filter and then makes turf throw — and an unhandled throw here
 * would reach the queue worker as a transient failure and be retried forever.
 * Degrading to null instead routes it to the visible cannot-run path.
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

    return { vertices, diameterMetres: siteDiameterMetres(geometries) }
  } catch (error) {
    logger.warn(
      structureErrorForECS(error),
      'Site geometry could not be converted to vertices, skipping site in nearest marine plan area query'
    )
    return null
  }
}

// applySearchBound exists only so tests can prove that equivalence.
export const findNearestMarinePlanArea = async ({
  db,
  site,
  logger,
  applySearchBound = true
}) => {
  const queryGeometry = deriveSiteQueryGeometry(site, logger)
  if (!queryGeometry) {
    return null
  }
  const { vertices, diameterMetres } = queryGeometry

  const anchor = await nearestAreaToPoint(db, vertices[0])
  if (!anchor) {
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
  return nearest ?? null
}
