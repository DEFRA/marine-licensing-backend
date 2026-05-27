import { buffer } from '@turf/turf'

const coastalAreasLabelProperty = 'marine_are'
const marineAreaApiLabelProperty = 'info'

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
      feature.properties[coastalAreasLabelProperty] ??
      feature.properties[marineAreaApiLabelProperty],
    geometry: {
      type: feature.geometry.type,
      coordinates: feature.geometry.coordinates
    },
    properties: feature.properties
  }))
}

/**
 * Convert WGS84 to Degrees Decimal Minutes format
 *
 * @param {string} coordinate - coordinate to convert
 * @param {boolean} isLatitude - is this a latitude value

 */
export const coordinatesToDegreesDecimalMinutes = (coordinate, isLatitude) => {
  if (isNaN(coordinate) || coordinate < -180 || coordinate > 180) {
    throw new Error(`Invalid coordinate value: ${coordinate}`)
  }
  if (isLatitude && (coordinate < -90 || coordinate > 90)) {
    throw new Error(`Latitude out of range: ${coordinate}`)
  }

  // Remove the minus sign so the maths works correctly; we track N/S/E/W separately
  const absolute = Math.abs(coordinate)

  const degrees = Math.floor(absolute)
  const minutes = ((absolute - degrees) * 60).toFixed(4)
  const direction = isLatitude
    ? coordinate >= 0
      ? 'N'
      : 'S'
    : coordinate >= 0
      ? 'E'
      : 'W'

  const paddedDegrees = String(degrees).padStart(2, '0')
  const paddedMinutes = minutes.padStart(7, '0')

  return `${paddedDegrees}° ${paddedMinutes}' ${direction}`
}
