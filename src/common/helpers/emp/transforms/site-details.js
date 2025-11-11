import { manualCoordsToEmpGeometry } from './manual-coordinates.js'

export const transformSiteDetails = (siteDetails) => {
  const isFileUploadCoordinates = siteDetails.some(
    (site) => site.coordinatesType === 'file'
  )
  if (isFileUploadCoordinates) {
    return [] // temporary; will be handled in ML-270
  }
  return manualCoordsToEmpGeometry(siteDetails)
}
