import { manualCoordsToEmpGeometry } from './manual-coordinates.js'
import { SPATIAL_REFERENCES } from '../../../constants/coordinates.js'

export const transformSiteDetails = (siteDetails) => {
  const isFileUploadCoordinates = siteDetails.some(
    (site) => site.coordinatesType === 'file'
  )
  if (isFileUploadCoordinates) {
    return {
      rings: [], // temporary; will be handled in ML-270
      spatialReference: SPATIAL_REFERENCES.WGS84
    }
  }
  return {
    rings: manualCoordsToEmpGeometry(siteDetails),
    spatialReference: SPATIAL_REFERENCES.WGS84
  }
}
