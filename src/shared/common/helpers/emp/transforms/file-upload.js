import { geojsonToArcGIS } from '@terraformer/arcgis'
import { SPATIAL_REFERENCES } from '../../../constants/coordinates.js'
import { generateCirclePolygon } from './circle-to-polygon.js'

/**
 * GeoJSON Point / KML placemarks become ArcGIS `{ x, y }` (no rings/paths).
 * EMP expects polygon rings; approximate the point as a small geodesic circle
 * so the map matches a point marker (not a square) and stays valid for polygon layers.
 */
const POINT_CIRCLE_RADIUS_METRES = 5

function arcgisPointToPolygonRing(longitude, latitude) {
  return generateCirclePolygon({
    longitude,
    latitude,
    radiusMetres: POINT_CIRCLE_RADIUS_METRES
  })
}

/**
 * Normalises ArcGIS JSON geometries from geojsonToArcGIS into an array of
 * coordinate rings/paths suitable for our EMP payload (grouped under `rings`).
 */
function coordSetsFromArcgisGeometry(geometry) {
  if (!geometry) {
    return []
  }

  const { rings, paths, points, x, y } = geometry

  if (Array.isArray(rings) && rings.length > 0) {
    return rings
  }
  if (Array.isArray(paths) && paths.length > 0) {
    return paths
  }
  if (Number.isFinite(x) && Number.isFinite(y)) {
    return [arcgisPointToPolygonRing(x, y)]
  }
  if (Array.isArray(points) && points.length > 0) {
    return points.map(([px, py]) => arcgisPointToPolygonRing(px, py))
  }

  return []
}

export const fileUploadToEmpGeometry = (siteDetails) => {
  const features = siteDetails.reduce((acc, site) => {
    return [...acc, ...site.geoJSON.features]
  }, [])
  const transformed = geojsonToArcGIS({ type: 'FeatureCollection', features })
  const geometries = transformed.reduce((acc, item) => {
    const sets = coordSetsFromArcgisGeometry(item.geometry)
    return [...acc, ...sets]
  }, [])
  return {
    rings: geometries,
    spatialReference: SPATIAL_REFERENCES.WGS84
  }
}
