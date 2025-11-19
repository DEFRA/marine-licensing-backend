import { describe, it, expect } from 'vitest'
import { transformSiteDetails } from './site-details.js'

describe('transformSiteDetails', () => {
  it('returns empty array for rings when siteDetails contains file upload with no features', () => {
    const siteDetails = [
      {
        coordinatesType: 'file',
        fileUploadType: 'kml',
        geoJSON: { type: 'FeatureCollection', features: [] }
      }
    ]

    const result = transformSiteDetails(siteDetails)

    expect(result.rings).toEqual([])
    expect(result.spatialReference).toEqual({ wkid: 4326 })
  })

  it('transforms manual coordinates for WGS84 polygon', () => {
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

    const result = transformSiteDetails(siteDetails)

    expect(result.spatialReference).toEqual({ wkid: 4326 })
    expect(result.rings).toHaveLength(1)
    expect(result.rings[0]).toEqual([
      [-1.0, 50.0],
      [-1.0, 51.0],
      [-2.0, 51.0],
      [-2.0, 50.0],
      [-1.0, 50.0] // Last point should match first point
    ])
  })

  it('returns empty rings array when siteDetails is empty', () => {
    const siteDetails = []

    const result = transformSiteDetails(siteDetails)

    expect(result).toEqual({
      rings: [],
      spatialReference: {
        wkid: 4326
      }
    })
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

    const result = transformSiteDetails(siteDetails)

    expect(result.rings).toHaveLength(1)
    expect(result.rings[0]).toBeDefined()
    expect(result.spatialReference).toEqual({ wkid: 4326 })
  })
})
