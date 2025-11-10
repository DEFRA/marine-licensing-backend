import Circle from '@arcgis/core/geometry/Circle.js'

export const generateCirclePolygon = ({
  latitude,
  longitude,
  radiusMetres
}) => {
  const circle = new Circle({
    center: [longitude, latitude],
    radius: radiusMetres,
    radiusUnits: 'meters',
    geodesic: true // Optional: true for spherical geometry
  })
  const circleGeom = circle.clone() // Create a clone to get the polygon
  const rings = circleGeom.rings // This is an array of rings, usually only one for a circle
  return rings[0] // The first (and only) ring contains the points
}
