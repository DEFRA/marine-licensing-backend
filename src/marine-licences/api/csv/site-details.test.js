import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSiteCoordinates } from './site-details.js'
import { generateCirclePolygon } from '../../../shared/common/helpers/emp/transforms/circle-to-polygon.js'
import { singleOSGB36toWGS84 } from '../../../shared/common/helpers/geo/geo-utils.js'

vi.mock(
  '../../../shared/common/helpers/emp/transforms/circle-to-polygon.js',
  () => ({ generateCirclePolygon: vi.fn() })
)

vi.mock('../../../shared/common/helpers/geo/geo-utils.js', () => ({
  singleOSGB36toWGS84: vi.fn()
}))

const mockPolygonRing = [
  [-0.1, 51.5],
  [-0.1, 51.501],
  [-0.099, 51.501],
  [-0.099, 51.5],
  [-0.1, 51.5]
]

const makeCircleSite = (overrides = {}) => ({
  coordinatesType: 'coordinates',
  coordinatesEntry: 'single',
  coordinateSystem: 'wgs84',
  coordinates: { latitude: '51.5', longitude: '-0.1' },
  circleWidth: '100',
  ...overrides
})

const makePolygonFeature = (ring) => ({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [ring] }
})

const makeFileUploadSite = (...rings) => ({
  coordinatesType: 'file',
  geoJSON: {
    type: 'FeatureCollection',
    features: rings.map(makePolygonFeature)
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  generateCirclePolygon.mockReturnValue(mockPolygonRing)
})

describe('getSiteCoordinates', () => {
  describe('circle sites', () => {
    it('returns one entry containing the polygon ring for a WGS84 circle site', () => {
      const result = getSiteCoordinates([makeCircleSite()])

      expect(generateCirclePolygon).toHaveBeenCalledWith({
        latitude: 51.5,
        longitude: -0.1,
        radiusMetres: 50
      })
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(mockPolygonRing)
    })

    it('converts OSGB36 to WGS84 before calling generateCirclePolygon for a circle site', () => {
      singleOSGB36toWGS84.mockReturnValue([-0.1, 51.5])

      const site = makeCircleSite({
        coordinateSystem: 'osgb36',
        coordinates: { easting: '530000', northing: '181000' },
        circleWidth: '200'
      })

      const result = getSiteCoordinates([site])

      expect(singleOSGB36toWGS84).toHaveBeenCalledWith(site.coordinates)
      expect(generateCirclePolygon).toHaveBeenCalledWith({
        latitude: 51.5,
        longitude: -0.1,
        radiusMetres: 100
      })
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(mockPolygonRing)
    })

    it('returns one entry per circle site', () => {
      const result = getSiteCoordinates([
        makeCircleSite(),
        makeCircleSite({ coordinates: { latitude: '52.0', longitude: '-1.0' } })
      ])

      expect(result).toHaveLength(2)
    })
  })

  describe('polygon sites', () => {
    it('returns mapped [lon, lat] pairs for a WGS84 polygon site', () => {
      const site = {
        coordinatesType: 'coordinates',
        coordinatesEntry: 'multiple',
        coordinateSystem: 'wgs84',
        coordinates: [
          { latitude: '51.5', longitude: '-0.1' },
          { latitude: '51.6', longitude: '-0.2' },
          { latitude: '51.7', longitude: '-0.3' }
        ]
      }

      const result = getSiteCoordinates([site])

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual([
        [-0.1, 51.5],
        [-0.2, 51.6],
        [-0.3, 51.7]
      ])
    })

    it('converts each OSGB36 coordinate to WGS84 for a polygon site', () => {
      singleOSGB36toWGS84
        .mockReturnValueOnce([-0.1, 51.5])
        .mockReturnValueOnce([-0.2, 51.6])
        .mockReturnValueOnce([-0.3, 51.7])

      const site = {
        coordinatesType: 'coordinates',
        coordinatesEntry: 'multiple',
        coordinateSystem: 'osgb36',
        coordinates: [
          { easting: '530000', northing: '181000' },
          { easting: '530100', northing: '181100' },
          { easting: '530200', northing: '181200' }
        ]
      }

      const result = getSiteCoordinates([site])

      expect(singleOSGB36toWGS84).toHaveBeenCalledTimes(3)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual([
        [-0.1, 51.5],
        [-0.2, 51.6],
        [-0.3, 51.7]
      ])
    })
  })

  describe('file upload sites (coordinatesType === "file")', () => {
    const ring1 = [
      [-1.0, 50.0],
      [-1.0, 51.0],
      [-2.0, 51.0],
      [-1.0, 50.0]
    ]
    const ring2 = [
      [-3.0, 52.0],
      [-3.0, 53.0],
      [-4.0, 53.0],
      [-3.0, 52.0]
    ]

    it('returns one entry for the site containing the feature coordinates', () => {
      const result = getSiteCoordinates([makeFileUploadSite(ring1)])

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual([[ring1]])
    })

    it('returns one entry for the site even when it has multiple features', () => {
      const result = getSiteCoordinates([makeFileUploadSite(ring1, ring2)])

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual([[ring1], [ring2]])
    })

    it('does not call generateCirclePolygon or singleOSGB36toWGS84 for file upload sites', () => {
      getSiteCoordinates([makeFileUploadSite(ring1)])

      expect(generateCirclePolygon).not.toHaveBeenCalled()
      expect(singleOSGB36toWGS84).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it.each([
      ['empty array', []],
      ['no argument', undefined]
    ])('returns an empty array when siteDetails is %s', (_, input) => {
      expect(getSiteCoordinates(input)).toEqual([])
    })

    it('returns an empty array for a site with an unrecognised coordinatesEntry', () => {
      expect(
        getSiteCoordinates([
          { coordinatesType: 'coordinates', coordinatesEntry: 'unknown' }
        ])
      ).toEqual([])
    })
  })
})
