import { geojsonToArcGIS } from '@terraformer/arcgis'
import { SPATIAL_REFERENCES } from '../../../constants/coordinates.js'

/**
 * Tiny square (in degrees) around a lon/lat so polygon-based EMP layers accept
 * GeoJSON Point / KML Point placemarks (ArcGIS REST uses x/y, not rings/paths).
 * ~5 m at the equator.
 */
const POINT_RING_OFFSET_DEG = 0.00005

function arcgisPointToRing(x, y) {
  const d = POINT_RING_OFFSET_DEG
  return [
    [x - d, y - d],
    [x + d, y - d],
    [x + d, y + d],
    [x - d, y + d],
    [x - d, y - d]
  ]
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
    return [arcgisPointToRing(x, y)]
  }
  if (Array.isArray(points) && points.length > 0) {
    return points.map(([px, py]) => arcgisPointToRing(px, py))
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
