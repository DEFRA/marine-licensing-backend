import { geojsonToArcGIS } from '@terraformer/arcgis'

export const fileUploadToEmpGeometry = (siteDetails) => {
  const features = siteDetails.reduce((acc, site) => {
    return [...acc, ...site.geoJSON.features]
  }, [])
  const transformed = geojsonToArcGIS({ type: 'FeatureCollection', features })
  const rings = transformed.map(
    (feature) => feature.geometry.rings?.[0] || feature.geometry.paths?.[0]
  )
  return {
    rings,
    spatialReference: transformed[0]?.geometry.spatialReference
  }
}
