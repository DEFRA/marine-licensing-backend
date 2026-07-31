import { distance, point } from '@turf/turf'
import { collectSiteVertices, siteDiameterMetres } from './site-vertices.js'

// A 4-vertex rectangle ~18km wide, ~2km tall at lat 54 — the sparse
// hand-drawn shape densification exists for (design §8: the nearest point of
// a long edge is mid-edge, which vertex-only querying would miss).
const sparseRectangle = {
  type: 'Polygon',
  coordinates: [
    [
      [-2.79, 54.04],
      [-2.79, 54.06],
      [-2.51, 54.06],
      [-2.51, 54.04],
      [-2.79, 54.04]
    ]
  ]
}

const gapsMetres = (vertices) => {
  const gaps = []
  for (let i = 1; i < vertices.length; i++) {
    gaps.push(distance(point(vertices[i - 1]), point(vertices[i])) * 1000)
  }
  return gaps
}

describe('collectSiteVertices', () => {
  it('should densify sparse edges so no consecutive gap exceeds the max spacing', () => {
    const vertices = collectSiteVertices([sparseRectangle], {
      maxSpacingMetres: 500,
      maxVertices: 1000
    })

    expect(vertices.length).toBeGreaterThan(10)
    // Vertices are emitted in boundary order, so consecutive gaps are the
    // densified segment steps.
    expect(Math.max(...gapsMetres(vertices))).toBeLessThanOrEqual(510)
  })

  it('should downsample evenly above the vertex cap', () => {
    const vertices = collectSiteVertices([sparseRectangle], {
      maxSpacingMetres: 100,
      maxVertices: 50
    })

    expect(vertices.length).toBeLessThanOrEqual(50)
  })

  it('should pass point geometries through as single vertices', () => {
    const vertices = collectSiteVertices(
      [{ type: 'Point', coordinates: [-2.7, 54.0] }],
      { maxSpacingMetres: 500, maxVertices: 50 }
    )

    expect(vertices).toEqual([[-2.7, 54.0]])
  })

  it('should de-duplicate the closing vertex of a ring', () => {
    const vertices = collectSiteVertices([sparseRectangle], {
      maxSpacingMetres: 1_000_000, // no densification
      maxVertices: 50
    })

    expect(vertices).toHaveLength(4) // closing coordinate not repeated
  })
})

describe('siteDiameterMetres', () => {
  it('should return at least the width of the rectangle', () => {
    const diameter = siteDiameterMetres([sparseRectangle])

    // ~18.3km wide at lat 54; bbox diagonal is a safe overestimate.
    expect(diameter).toBeGreaterThan(18_000)
    expect(diameter).toBeLessThan(25_000)
  })
})
