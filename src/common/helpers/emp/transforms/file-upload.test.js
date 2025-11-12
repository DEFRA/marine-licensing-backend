import { describe, it, expect } from 'vitest'
import { fileUploadToEmpGeometry } from './file-upload.js'

describe('fileUploadToEmpGeometry', () => {
  it('transforms single site with geoJSON features to EMP geometry format', () => {
    const siteDetails = [
      {
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

    const result = fileUploadToEmpGeometry(siteDetails)

    expect(result.rings).toHaveLength(1)
    // terraformer converts GeoJSON [lon, lat] to ArcGIS [x, y] format
    expect(result.rings[0]).toEqual([
      [-1, 50],
      [-2, 50],
      [-2, 51],
      [-1, 51],
      [-1, 50]
    ])
    expect(result.spatialReference).toEqual({ wkid: 4326 })
  })

  it('transforms multiple sites with multiple features', () => {
    const siteDetails = [
      {
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
                    [-1.1, 50.0],
                    [-1.1, 50.1],
                    [-1.0, 50.1],
                    [-1.0, 50.0]
                  ]
                ]
              }
            }
          ]
        }
      },
      {
        geoJSON: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [-2.0, 51.0],
                    [-2.1, 51.0],
                    [-2.1, 51.1],
                    [-2.0, 51.1],
                    [-2.0, 51.0]
                  ]
                ]
              }
            },
            {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [-3.0, 52.0],
                    [-3.1, 52.0],
                    [-3.1, 52.1],
                    [-3.0, 52.1],
                    [-3.0, 52.0]
                  ]
                ]
              }
            }
          ]
        }
      }
    ]

    const result = fileUploadToEmpGeometry(siteDetails)

    expect(result.rings).toHaveLength(3)
    expect(result.rings[0]).toEqual([
      [-1.0, 50.0],
      [-1.1, 50.0],
      [-1.1, 50.1],
      [-1.0, 50.1],
      [-1.0, 50.0]
    ])
    expect(result.rings[1]).toEqual([
      [-2.0, 51.0],
      [-2.1, 51.0],
      [-2.1, 51.1],
      [-2.0, 51.1],
      [-2.0, 51.0]
    ])
    expect(result.rings[2]).toEqual([
      [-3.0, 52.0],
      [-3.1, 52.0],
      [-3.1, 52.1],
      [-3.0, 52.1],
      [-3.0, 52.0]
    ])
    expect(result.spatialReference).toEqual({ wkid: 4326 })
  })

  it('handles features with paths instead of rings (LineString geometries)', () => {
    const siteDetails = [
      {
        geoJSON: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [-1.0, 50.0],
                  [-2.0, 51.0]
                ]
              }
            }
          ]
        }
      }
    ]

    const result = fileUploadToEmpGeometry(siteDetails)

    expect(result.rings).toHaveLength(1)
    expect(result.rings[0]).toEqual([
      [-1.0, 50.0],
      [-2.0, 51.0]
    ])
    expect(result.spatialReference).toEqual({ wkid: 4326 })
  })

  it('handles empty site details', () => {
    const siteDetails = []

    const result = fileUploadToEmpGeometry(siteDetails)

    expect(result.rings).toEqual([])
    expect(result.spatialReference).toBeUndefined()
  })

  it('handles sites with empty features arrays', () => {
    const siteDetails = [
      {
        geoJSON: {
          type: 'FeatureCollection',
          features: []
        }
      },
      {
        geoJSON: {
          type: 'FeatureCollection',
          features: []
        }
      }
    ]

    const result = fileUploadToEmpGeometry(siteDetails)

    expect(result.rings).toEqual([])
    expect(result.spatialReference).toBeUndefined()
  })

  it('extracts spatialReference from first transformed feature', () => {
    const siteDetails = [
      {
        geoJSON: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [0, 0]
              }
            }
          ]
        }
      }
    ]

    const result = fileUploadToEmpGeometry(siteDetails)

    expect(result.spatialReference).toEqual({ wkid: 4326 })
  })

  it('handles mixed geometry types with both rings and paths', () => {
    const siteDetails = [
      {
        geoJSON: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [0, 0],
                    [1, 1],
                    [1, 0],
                    [0, 0]
                  ]
                ]
              }
            },
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [2, 2],
                  [3, 3]
                ]
              }
            }
          ]
        }
      }
    ]

    const result = fileUploadToEmpGeometry(siteDetails)

    expect(result.rings).toHaveLength(2)
    // First feature is a Polygon (rings)
    expect(result.rings[0]).toEqual([
      [0, 0],
      [1, 1],
      [1, 0],
      [0, 0]
    ])
    // Second feature is a LineString (paths)
    expect(result.rings[1]).toEqual([
      [2, 2],
      [3, 3]
    ])
    expect(result.spatialReference).toEqual({ wkid: 4326 })
  })
})
