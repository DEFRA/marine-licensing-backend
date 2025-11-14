import { manualCoordsToEmpGeometry } from './manual-coordinates.js'
import { SPATIAL_REFERENCES } from '../../../constants/coordinates.js'
import { fileUploadToEmpGeometry } from './file-upload.js'

export const transformSiteDetails = (siteDetails) => {
  const isFileUploadCoordinates = siteDetails.some(
    (site) => site.coordinatesType === 'file'
  )
  if (isFileUploadCoordinates) {
    return fileUploadToEmpGeometry(siteDetails)
  }
  return {
    rings: manualCoordsToEmpGeometry(siteDetails),
    spatialReference: SPATIAL_REFERENCES.WGS84
  }
}
