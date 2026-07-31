import { collectionMarinePlanAreasSimplified } from '../../../../shared/common/constants/db-collections.js'
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

// Manual-coordinates polygon site: closer to the WEST area, but its western
// EDGE is what is close — the eastern vertices are nearer the east area's
// longitude midline, so vertex-min matters.
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
        error: expect.objectContaining({ type: 'TypeError' })
      }),
      expect.stringContaining('vertices')
    )
  })
})
