import { buffer } from '@turf/turf'

export const formatGeoForStorage = (geoJson) => {
  // The buffer(0) operation forces a geometry rebuild, dissolving self-intersections to pass MongoDB validation.
  const processed = buffer(geoJson, 0)

  return processed.features.map((feature) => ({
    type: 'Feature',
    name: feature.properties.info,
    geometry: {
      type: feature.geometry.type,
      coordinates: feature.geometry.coordinates
    },
    properties: feature.properties
  }))
}
