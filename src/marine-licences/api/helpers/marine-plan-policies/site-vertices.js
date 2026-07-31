import {
  bbox,
  coordAll,
  distance,
  lineChunk,
  point,
  polygonToLine
} from '@turf/turf'

const METRES_PER_KM = 1000

/**
 * The fallback measures distance from the site's EDGE, but $geoNear only
 * accepts point origins — so the edge is represented by its vertices,
 * densified so no gap exceeds maxSpacingMetres, which bounds the
 * edge-distance error at half that spacing.
 *
 * Densification is composed from turf primitives: the boundary becomes
 * lines (polygonToLine), lineChunk cuts them into pieces no longer than the
 * spacing, and coordAll collects every original and interpolated vertex.
 * Chunk endpoints repeat (each chunk starts where the last ended) and rings
 * repeat their closing coordinate — the Set below de-duplicates both.
 *
 * That bound holds only while the densified count stays under maxVertices.
 * Above it the even downsample keeps every step-th vertex, multiplying the
 * spacing and the error bound alike by step. The heaviest real site measured
 * (548 vertices densified, in a 599m-wide polygon) lands on step 3: 1500m
 * effective spacing, 750m error bound.
 *
 * "Densify": https://support.esri.com/en-us/gis-dictionary/densify
 */
const densifiedBoundaryCoords = (geometry, maxSpacingMetres) => {
  const { type } = geometry
  if (type === 'Point' || type === 'MultiPoint') {
    return coordAll(geometry)
  }
  // Upstream site parsing only emits coordinate-bearing geometry types, so
  // everything else here is a line or a polygon boundary to be chunked.
  const boundary =
    type === 'Polygon' || type === 'MultiPolygon'
      ? polygonToLine(geometry)
      : geometry
  return coordAll(
    lineChunk(boundary, maxSpacingMetres / METRES_PER_KM, {
      units: 'kilometers'
    })
  )
}

export const collectSiteVertices = (
  geometries,
  { maxSpacingMetres, maxVertices }
) => {
  const seen = new Set()
  const vertices = []
  for (const geometry of geometries) {
    for (const coords of densifiedBoundaryCoords(geometry, maxSpacingMetres)) {
      const key = `${coords[0]},${coords[1]}`
      if (!seen.has(key)) {
        seen.add(key)
        vertices.push(coords)
      }
    }
  }

  if (vertices.length <= maxVertices) {
    return vertices
  }
  // Even downsample to keep the query inside its latency budget: every vertex
  // is one $geoNear, ~6.6ms for a site far from any area. This COARSENS the
  // spacing the densify step above just established — effective spacing
  // becomes step * maxSpacingMetres, and the error bound half of that.
  const step = Math.ceil(vertices.length / maxVertices)
  return vertices.filter((_, i) => i % step === 0)
}

// Bounding-box diagonal: a cheap OVERESTIMATE of the widest span of the site.
// Only used in the search bound, where any overestimate is safe.
export const siteDiameterMetres = (geometries) => {
  const [minX, minY, maxX, maxY] = bbox({
    type: 'GeometryCollection',
    geometries
  })
  return distance(point([minX, minY]), point([maxX, maxY])) * METRES_PER_KM
}
