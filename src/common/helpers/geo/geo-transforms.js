import { buffer } from '@turf/turf'

const arcGisLabelProperty = 'Marine_Are'
const environmentApiLabelProperty = 'info'

export const formatGeoForStorage = (geoJson) => {
  /**
   * The buffer(0) operation forces a geometry rebuild that automatically resolves self-intersections
   * (where polygon edges cross over themselves).
   *
   * This is required because MongoDB has strict GeoJSON validation and will reject self-intersecting shapes
   *
   * Self-intersections can occur from user-drawn shapes or programmatic transformations.
   * The zero-distance buffer acts as a normalizer that fixes these structural issues without changing the geometry's actual shape or location
   */
  const processed = buffer(geoJson, 0)

  return processed.features.map((feature) => ({
    type: 'Feature',
    name:
      feature.properties[arcGisLabelProperty] ??
      feature.properties[environmentApiLabelProperty],
    geometry: {
      type: feature.geometry.type,
      coordinates: feature.geometry.coordinates
    },
    properties: feature.properties
  }))
}
