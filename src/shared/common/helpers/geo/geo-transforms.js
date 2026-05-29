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

const LONGITUDE_MAX = 180
const LATITUDE_MAX = 90
const MINUTES_PER_DEGREE = 60
const MINUTES_DECIMAL_PLACES = 4
const DEGREE_PAD_LENGTH = 2
const MINUTES_PAD_LENGTH = 7

const DIRECTIONS = {
  north: 'N',
  south: 'S',
  east: 'E',
  west: 'W'
}

/**
 * Convert WGS84 to Degrees Decimal Minutes format
 *
 * @param {number} coordinate - coordinate to convert
 * @param {boolean} isLatitude - is this a latitude value
 */
export const coordinatesToDegreesDecimalMinutes = (coordinate, isLatitude) => {
  if (
    Number.isNaN(coordinate) ||
    coordinate < -LONGITUDE_MAX ||
    coordinate > LONGITUDE_MAX
  ) {
    throw new Error(`Invalid coordinate value: ${coordinate}`)
  }
  if (isLatitude && (coordinate < -LATITUDE_MAX || coordinate > LATITUDE_MAX)) {
    throw new Error(`Latitude out of range: ${coordinate}`)
  }

  // Remove the minus sign so the maths works correctly; we track N/S/E/W separately
  const absolute = Math.abs(coordinate)

  const degrees = Math.floor(absolute)
  const minutes = ((absolute - degrees) * MINUTES_PER_DEGREE).toFixed(
    MINUTES_DECIMAL_PLACES
  )
  const isPositive = coordinate >= 0
  const direction = isLatitude
    ? isPositive
      ? DIRECTIONS.north
      : DIRECTIONS.south
    : isPositive
      ? DIRECTIONS.east
      : DIRECTIONS.west

  const paddedDegrees = String(degrees).padStart(DEGREE_PAD_LENGTH, '0')
  const paddedMinutes = minutes.padStart(MINUTES_PAD_LENGTH, '0')

  return `${paddedDegrees}° ${paddedMinutes}' ${direction}`
}
