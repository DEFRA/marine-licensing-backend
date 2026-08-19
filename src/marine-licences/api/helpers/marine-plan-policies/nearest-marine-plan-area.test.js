import { collectionMarinePlanAreasSimplified } from '../../../../shared/common/constants/db-collections.js'
import { MARINE_PLAN_POLICY_EVENT_ACTION } from '../../../constants/marine-licence.js'
import {
  deriveNearestAreaSearchBound,
  findNearestMarinePlanArea
} from './nearest-marine-plan-area.js'

// Two areas either side of the sites: 'west' centred ~[-1.2, 54], 'east'
// centred ~[1.2, 54]. Dimensions are in DEGREES: 0.2° per side is ~22km
// north-south and ~13km east-west at this latitude (longitude degrees
// shrink by cos(latitude)).
const square = (cx, cy, halfDegrees = 0.1) => ({
  type: 'Polygon',
  coordinates: [
    [
      [cx - halfDegrees, cy - halfDegrees],
      [cx + halfDegrees, cy - halfDegrees],
      [cx + halfDegrees, cy + halfDegrees],
      [cx - halfDegrees, cy + halfDegrees],
      [cx - halfDegrees, cy - halfDegrees]
    ]
  ]
})

const areaDoc = (name, regionref, geometry) => ({
  type: 'Feature',
  name,
  geometry,
  properties: { regionref }
})

// Manual-coordinates polygon site, unambiguously nearest the WEST area. What
// it discriminates is edge-versus-centroid: the site's western edge sits
// ~3.3km from the area, while its centroid is ~8.2km away, so measuring from
// the centroid rather than the boundary vertices fails the distance assertion
// below.
const siteNearWest = {
  coordinatesType: 'coordinates',
  coordinatesEntry: 'multiple',
  coordinateSystem: 'wgs84',
  coordinates: [
    { latitude: '53.99', longitude: '-1.05' },
    { latitude: '54.01', longitude: '-1.05' },
    { latitude: '54.01', longitude: '-0.9' },
    { latitude: '53.99', longitude: '-0.9' }
  ]
}

// Single-coordinate sites are stored as a centre point plus a width and become
// a circle polygon, so unlike the other two entry types their converter
// returns one geometry rather than a list of them.
const circleSiteNearWest = {
  coordinatesType: 'coordinates',
  coordinatesEntry: 'single',
  coordinateSystem: 'wgs84',
  coordinates: { latitude: '54', longitude: '-1.05' },
  circleWidth: '2000'
}

// Uploaded-file sites carry raw GeoJSON features; the file converter keeps any
// feature whose geometry has a `coordinates` key, and an empty array passes
// that check — so malformed geometries reach the vertex collection intact.
const fileSite = (geometry) => ({
  coordinatesType: 'file',
  siteName: 'Malformed site',
  geoJSON: { features: [{ type: 'Feature', geometry }] }
})

describe('deriveNearestAreaSearchBound', () => {
  it('should be the anchor distance plus the site diameter', () => {
    expect(
      deriveNearestAreaSearchBound({
        anchorDistanceMetres: 10_000,
        siteDiameterMetres: 2_000
      })
    ).toBe(12_000)
  })
})

describe('findNearestMarinePlanArea', () => {
  const simplified = () =>
    global.mockMongo.collection(collectionMarinePlanAreasSimplified)
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

  beforeEach(async () => {
    await simplified().deleteMany({})
    await simplified().insertMany([
      areaDoc('West area', 'NW_i', square(-1.2, 54)),
      areaDoc('East area', 'E_i', square(1.2, 54))
    ])
    await simplified().createIndex({ geometry: '2dsphere' })
  })

  it('should return the nearest area with regionref and a distance in metres', async () => {
    const nearest = await findNearestMarinePlanArea({
      db: global.mockMongo,
      site: siteNearWest,
      logger
    })

    expect(nearest.regionref).toBe('NW_i')
    expect(nearest.name).toBe('West area')
    // Site west edge at -1.05, area east edge at -1.1 → ~3.3km at lat 54.
    expect(nearest.distanceMetres).toBeGreaterThan(1_000)
    expect(nearest.distanceMetres).toBeLessThan(6_000)
  })

  it('should return the nearest area for a single-coordinate circle site', async () => {
    const nearest = await findNearestMarinePlanArea({
      db: global.mockMongo,
      site: circleSiteNearWest,
      logger
    })

    expect(nearest.regionref).toBe('NW_i')
    // Centre at -1.05 is ~3.3km from the area's -1.1 edge, less the circle's
    // 1km radius — so the measurement starts from the circle's edge, not its
    // centre.
    expect(nearest.distanceMetres).toBeGreaterThan(1_000)
    expect(nearest.distanceMetres).toBeLessThan(3_000)
  })

  it('should return an identical result without the search bound', async () => {
    const bounded = await findNearestMarinePlanArea({
      db: global.mockMongo,
      site: siteNearWest,
      logger
    })
    const unbounded = await findNearestMarinePlanArea({
      db: global.mockMongo,
      site: siteNearWest,
      logger,
      applySearchBound: false
    })

    expect(unbounded).toEqual(bounded)
  })

  it('should return null when the simplified collection is empty (cannot-run guard)', async () => {
    await simplified().deleteMany({})

    const nearest = await findNearestMarinePlanArea({
      db: global.mockMongo,
      site: siteNearWest,
      logger
    })

    expect(nearest).toBeNull()
  })

  it('should return null for a site with no geometries', async () => {
    const nearest = await findNearestMarinePlanArea({
      db: global.mockMongo,
      site: { coordinatesType: 'file', geoJSON: { features: [] } },
      logger
    })

    expect(nearest).toBeNull()
  })

  it('should return null for a geometry that yields no vertices', async () => {
    const nearest = await findNearestMarinePlanArea({
      db: global.mockMongo,
      site: fileSite({ type: 'MultiPolygon', coordinates: [] }),
      logger
    })

    expect(nearest).toBeNull()
    // An empty MultiPolygon converts cleanly to zero vertices, so this is the
    // vertex-count guard rather than the malformed-geometry catch below.
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('should return null and warn when the geometry cannot be converted to vertices', async () => {
    const nearest = await findNearestMarinePlanArea({
      db: global.mockMongo,
      site: fileSite({ type: 'Polygon', coordinates: [] }),
      logger
    })

    expect(nearest).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ type: 'TypeError' }),
        event: expect.objectContaining({
          action: MARINE_PLAN_POLICY_EVENT_ACTION.SITE_GEOMETRY_INVALID,
          outcome: 'failure',
          reference: 'Malformed site'
        })
      }),
      expect.stringContaining('vertices')
    )
  })

  it('should return null and warn for coordinates outside the valid longitude/latitude range', async () => {
    const nearest = await findNearestMarinePlanArea({
      db: global.mockMongo,
      // Eastings and northings stored as if they were degrees: turf densifies
      // these without complaint, so only an explicit range check catches them.
      // Unnamed, so this also covers the missing-siteName log reference.
      site: {
        coordinatesType: 'file',
        geoJSON: {
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [430000, 370000],
                    [430100, 370000],
                    [430100, 370100],
                    [430000, 370000]
                  ]
                ]
              }
            }
          ]
        }
      },
      logger
    })

    expect(nearest).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: MARINE_PLAN_POLICY_EVENT_ACTION.SITE_GEOMETRY_INVALID,
          outcome: 'failure',
          reference: 'unknown site'
        })
      }),
      expect.stringContaining('outside the valid longitude/latitude range')
    )
  })

  it('should return null and warn when the simplified collection does not exist', async () => {
    await simplified().drop()

    const nearest = await findNearestMarinePlanArea({
      db: global.mockMongo,
      site: siteNearWest,
      logger
    })

    expect(nearest).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: MARINE_PLAN_POLICY_EVENT_ACTION.NEAREST_AREA_UNAVAILABLE,
          outcome: 'failure',
          reference: collectionMarinePlanAreasSimplified
        })
      }),
      expect.stringContaining('cannot run')
    )
  })

  it('should return null and warn when the geo index is missing', async () => {
    await simplified().dropIndexes()

    const nearest = await findNearestMarinePlanArea({
      db: global.mockMongo,
      site: siteNearWest,
      logger
    })

    expect(nearest).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: MARINE_PLAN_POLICY_EVENT_ACTION.NEAREST_AREA_UNAVAILABLE
        })
      }),
      expect.stringContaining('cannot run')
    )
  })

  it('should return null and warn when the geo index is on the wrong field', async () => {
    await simplified().dropIndexes()
    await simplified().createIndex({ somethingElse: '2dsphere' })

    const nearest = await findNearestMarinePlanArea({
      db: global.mockMongo,
      site: siteNearWest,
      logger
    })

    // Naming the key is what makes this loud: an unkeyed $geoNear would pick
    // the unrelated index, return no rows and look like an empty collection.
    expect(nearest).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: MARINE_PLAN_POLICY_EVENT_ACTION.NEAREST_AREA_UNAVAILABLE
        })
      }),
      expect.stringContaining('cannot run')
    )
  })

  it('should rethrow database errors that are not a missing collection or index', async () => {
    const failing = {
      collection: () => ({
        aggregate: () => ({
          toArray: async () => {
            const error = new Error('connection reset')
            error.code = 6 // HostUnreachable — transient, must stay retryable
            throw error
          }
        })
      })
    }

    await expect(
      findNearestMarinePlanArea({ db: failing, site: siteNearWest, logger })
    ).rejects.toThrow('connection reset')
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('should return null and warn for non-finite coordinates', async () => {
    const nearest = await findNearestMarinePlanArea({
      db: global.mockMongo,
      // Comparisons against null are false on both sides, so a range test
      // alone would wave these through to $geoNear.
      site: fileSite({ type: 'Point', coordinates: [null, null] }),
      logger
    })

    expect(nearest).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: MARINE_PLAN_POLICY_EVENT_ACTION.SITE_GEOMETRY_INVALID,
          outcome: 'failure',
          reference: 'Malformed site'
        })
      }),
      expect.stringContaining('outside the valid longitude/latitude range')
    )
  })

  it('should break an exact distance tie on regionref', async () => {
    // Two vertices mirrored about longitude 0, each 0.6 degrees from the
    // nearer edge of its own area, so the two lookups return bit-identical
    // distances. Insertion and vertex order both put the west area first, so
    // only the regionref tiebreaker can make the lexicographically first
    // regionref win.
    const nearest = await findNearestMarinePlanArea({
      db: global.mockMongo,
      site: fileSite({
        type: 'MultiPoint',
        coordinates: [
          [-0.5, 54],
          [0.5, 54]
        ]
      }),
      logger
    })

    expect(nearest.regionref).toBe('E_i')
    expect(nearest.name).toBe('East area')
  })

  it('should return null when the per-vertex phase finds nothing', async () => {
    // Phase 1 hits the real indexed collection and finds the anchor; phase 2
    // is stubbed empty, which is otherwise only reachable if the collection is
    // dropped between the two queries.
    const emptyPhaseTwo = {
      collection: (name) => global.mockMongo.collection(name),
      aggregate: () => ({ toArray: async () => [] })
    }

    const nearest = await findNearestMarinePlanArea({
      db: emptyPhaseTwo,
      site: siteNearWest,
      logger
    })

    expect(nearest).toBeNull()
  })
})
