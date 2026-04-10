import { describe, it, expect } from 'vitest'
import { buildEmpGeometries } from './site-details.js'

describe('buildEmpGeometries', () => {
  it('returns a single geometry with empty rings for a file upload with no features', () => {
    const siteDetails = [
      {
        coordinatesType: 'file',
        fileUploadType: 'kml',
        geoJSON: { type: 'FeatureCollection', features: [] }
      }
    ]

    const result = buildEmpGeometries(siteDetails)

    expect(result).toHaveLength(1)
    expect(result[0].rings).toEqual([])
    expect(result[0].spatialReference).toEqual({ wkid: 4326 })
  })

  it('returns a single geometry for a manual WGS84 polygon', () => {
    const siteDetails = [
      {
        coordinatesType: 'coordinates',
        coordinatesEntry: 'multiple',
        coordinateSystem: 'wgs84',
        coordinates: [
          { latitude: '50.0', longitude: '-1.0' },
          { latitude: '51.0', longitude: '-1.0' },
          { latitude: '51.0', longitude: '-2.0' },
          { latitude: '50.0', longitude: '-2.0' }
        ]
      }
    ]

    const result = buildEmpGeometries(siteDetails)

    expect(result).toHaveLength(1)
    expect(result[0].spatialReference).toEqual({ wkid: 4326 })
    expect(result[0].rings).toHaveLength(1)
    expect(result[0].rings[0]).toEqual([
      [-1.0, 50.0],
      [-1.0, 51.0],
      [-2.0, 51.0],
      [-2.0, 50.0],
      [-1.0, 50.0] // Last point should match first point
    ])
  })

  it('returns a single empty geometry when siteDetails is empty', () => {
    const result = buildEmpGeometries([])

    expect(result).toEqual([
      {
        rings: [],
        spatialReference: { wkid: 4326 }
      }
    ])
  })

  it('uses fileUploadToEmpGeometry for file upload with features', () => {
    const siteDetails = [
      {
        coordinatesType: 'file',
        fileUploadType: 'geojson',
        geoJSON: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [-1.0, 50.0],
                    [-1.0, 51.0],
                    [-2.0, 51.0],
                    [-2.0, 50.0],
                    [-1.0, 50.0]
                  ]
                ]
              }
            }
          ]
        }
      }
    ]

    const result = buildEmpGeometries(siteDetails)

    expect(result).toHaveLength(1)
    expect(result[0].rings).toHaveLength(1)
    expect(result[0].rings[0]).toBeDefined()
    expect(result[0].spatialReference).toEqual({ wkid: 4326 })
  })

  it('splits manual circle sites into one geometry per site (ML-1222)', () => {
    const siteDetails = [
      {
        coordinatesType: 'coordinates',
        coordinatesEntry: 'single',
        coordinateSystem: 'wgs84',
        coordinates: { latitude: '55.019889', longitude: '-1.399500' },
        circleWidth: '1'
      },
      {
        coordinatesType: 'coordinates',
        coordinatesEntry: 'single',
        coordinateSystem: 'wgs84',
        coordinates: { latitude: '55.020000', longitude: '-1.400000' },
        circleWidth: '1'
      }
    ]

    const result = buildEmpGeometries(siteDetails)

    expect(result).toHaveLength(2)
    expect(result[0].rings).toHaveLength(1)
    expect(result[1].rings).toHaveLength(1)
    expect(result[0].spatialReference).toEqual({ wkid: 4326 })
    expect(result[1].spatialReference).toEqual({ wkid: 4326 })
    // The two rings should be distinct
    expect(result[0].rings[0]).not.toEqual(result[1].rings[0])
  })

  it('separates manual circle sites from manual polygon sites in a mixed exemption', () => {
    const siteDetails = [
      {
        coordinatesType: 'coordinates',
        coordinatesEntry: 'single',
        coordinateSystem: 'wgs84',
        coordinates: { latitude: '55.0', longitude: '-1.4' },
        circleWidth: '50'
      },
      {
        coordinatesType: 'coordinates',
        coordinatesEntry: 'multiple',
        coordinateSystem: 'wgs84',
        coordinates: [
          { latitude: '50.0', longitude: '-1.0' },
          { latitude: '51.0', longitude: '-1.0' },
          { latitude: '51.0', longitude: '-2.0' },
          { latitude: '50.0', longitude: '-2.0' }
        ]
      }
    ]

    const result = buildEmpGeometries(siteDetails)

    // One feature for the circle, one feature for the polygon.
    expect(result).toHaveLength(2)
    expect(result[0].rings).toHaveLength(1)
    expect(result[1].rings).toHaveLength(1)
  })
})
