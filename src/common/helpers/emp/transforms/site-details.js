import { manualCoordsToEmpGeometry } from './manual-coordinates.js'

export const transformSiteDetails = (siteDetails) => {
  const isFileUploadCoordinates = siteDetails.some(
    (site) => site.coordinatesType === 'file'
  )
  if (isFileUploadCoordinates) {
    return []
  }
  return manualCoordsToEmpGeometry(siteDetails)
}
