import { distance, point } from '@turf/turf'
import {
  calculateSiteDiameterMetres,
  collectSiteVertices
} from './site-vertices.js'

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
    // Vertices are emitted in boundary order for this single-ring fixture;
    // ring joins in holed/multi geometries break gap adjacency, which is
    // fine — the query treats vertices as an unordered set.
    expect(Math.max(...gapsMetres(vertices))).toBeLessThanOrEqual(510)
  })

  it('should densify a bare LineString without an enclosing polygon', () => {
    const vertices = collectSiteVertices(
      [
        {
          type: 'LineString',
          coordinates: [
            [-2.79, 54.04],
            [-2.51, 54.04]
          ]
        }
      ],
      { maxSpacingMetres: 500, maxVertices: 1000 }
    )

    expect(vertices.length).toBeGreaterThan(10)
    expect(Math.max(...gapsMetres(vertices))).toBeLessThanOrEqual(510)
  })

  it('should downsample evenly above the vertex cap', () => {
    const vertices = collectSiteVertices([sparseRectangle], {
      maxSpacingMetres: 100,
      maxVertices: 50
    })

    expect(vertices.length).toBeLessThanOrEqual(50)
    // Not just an upper bound: confirms downsampling actually ran (this
    // fixture densifies to 414 vertices at 100m spacing) rather than
    // vacuously passing on an empty or tiny result.
    expect(vertices.length).toBeGreaterThan(40)
    // step = ceil(414 / 50) = 9, so the coarsened spacing is 9 * 100m =
    // 900m; 1000 gives headroom without loosening the check to meaninglessness.
    expect(Math.max(...gapsMetres(vertices))).toBeLessThan(1000)
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

describe('calculateSiteDiameterMetres', () => {
  it('should return at least the width of the rectangle', () => {
    const diameter = calculateSiteDiameterMetres([sparseRectangle])

    // ~18.3km wide at lat 54; bbox diagonal is a safe overestimate.
    expect(diameter).toBeGreaterThan(18_000)
    expect(diameter).toBeLessThan(25_000)
  })
})
