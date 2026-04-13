import { describe, it, expect, vi, afterEach } from 'vitest'
import * as TerraformerArcgis from '@terraformer/arcgis'
import { fileUploadToEmpGeometry } from './file-upload.js'

const dummySiteDetails = [
  {
    geoJSON: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] }
        }
      ]
    }
  }
]

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

  it('handles Point geometry (e.g. KML Placemark with Point) as a geodesic circle', () => {
    const siteDetails = [
      {
        geoJSON: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [-4.1525, 50.3475]
              }
            }
          ]
        }
      }
    ]

    const result = fileUploadToEmpGeometry(siteDetails)

    expect(result.rings).toHaveLength(1)
    const ring = result.rings[0]
    expect(ring.length).toBeGreaterThan(8)
    expect(ring[0][0]).toBeCloseTo(ring.at(-1)[0], 5)
    expect(ring[0][1]).toBeCloseTo(ring.at(-1)[1], 5)

    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length
    const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length
    expect(cx).toBeCloseTo(-4.1525, 2)
    expect(cy).toBeCloseTo(50.3475, 2)

    expect(result.spatialReference).toEqual({ wkid: 4326 })
  })

  it('handles MultiPoint as separate geodesic circle rings', () => {
    const siteDetails = [
      {
        geoJSON: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'MultiPoint',
                coordinates: [
                  [-4.0, 50.0],
                  [-5.0, 51.0]
                ]
              }
            }
          ]
        }
      }
    ]

    const result = fileUploadToEmpGeometry(siteDetails)

    expect(result.rings).toHaveLength(2)
    for (const ring of result.rings) {
      expect(ring.length).toBeGreaterThan(8)
      expect(ring[0][0]).toBeCloseTo(ring.at(-1)[0], 5)
      expect(ring[0][1]).toBeCloseTo(ring.at(-1)[1], 5)
    }

    const c0x =
      result.rings[0].reduce((s, p) => s + p[0], 0) / result.rings[0].length
    const c0y =
      result.rings[0].reduce((s, p) => s + p[1], 0) / result.rings[0].length
    expect(c0x).toBeCloseTo(-4.0, 2)
    expect(c0y).toBeCloseTo(50.0, 2)

    const c1x =
      result.rings[1].reduce((s, p) => s + p[0], 0) / result.rings[1].length
    const c1y =
      result.rings[1].reduce((s, p) => s + p[1], 0) / result.rings[1].length
    expect(c1x).toBeCloseTo(-5.0, 2)
    expect(c1y).toBeCloseTo(51.0, 2)

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
    expect(result.spatialReference).toEqual({ wkid: 4326 })
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
    expect(result.spatialReference).toEqual({ wkid: 4326 })
  })

  it('always returns WGS84 spatial reference', () => {
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
                    [1, 0],
                    [1, 1],
                    [0, 1],
                    [0, 0]
                  ]
                ]
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

describe('fileUploadToEmpGeometry when ArcGIS conversion returns edge cases', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('omits rings when geojsonToArcGIS yields null geometry', () => {
    vi.spyOn(TerraformerArcgis, 'geojsonToArcGIS').mockReturnValue([
      { geometry: null }
    ])

    const result = fileUploadToEmpGeometry(dummySiteDetails)

    expect(result.rings).toEqual([])
    expect(result.spatialReference).toEqual({ wkid: 4326 })
  })

  it('omits rings when geometry has empty rings and paths only', () => {
    vi.spyOn(TerraformerArcgis, 'geojsonToArcGIS').mockReturnValue([
      {
        geometry: {
          rings: [],
          paths: [],
          spatialReference: { wkid: 4326 }
        }
      }
    ])

    const result = fileUploadToEmpGeometry(dummySiteDetails)

    expect(result.rings).toEqual([])
  })

  it('omits rings when point has non-finite coordinates', () => {
    vi.spyOn(TerraformerArcgis, 'geojsonToArcGIS').mockReturnValue([
      {
        geometry: {
          x: Number.NaN,
          y: 50,
          spatialReference: { wkid: 4326 }
        }
      }
    ])

    const result = fileUploadToEmpGeometry(dummySiteDetails)

    expect(result.rings).toEqual([])
  })
})
