import { geojsonToArcGIS } from '@terraformer/arcgis'
import { SPATIAL_REFERENCES } from '../../../constants/coordinates.js'

export const fileUploadToEmpGeometry = (siteDetails) => {
  const features = siteDetails.reduce((acc, site) => {
    return [...acc, ...site.geoJSON.features]
  }, [])
  const transformed = geojsonToArcGIS({ type: 'FeatureCollection', features })
  const geometries = transformed.reduce((acc, feature) => {
    const coordSets = feature.geometry.rings || feature.geometry.paths
    return [...acc, ...coordSets]
  }, [])
  return {
    rings: geometries,
    spatialReference: SPATIAL_REFERENCES.WGS84
  }
}
