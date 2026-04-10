import {
  manualCoordsToEmpGeometry,
  manualSiteToEmpRing
} from './manual-coordinates.js'
import { SPATIAL_REFERENCES } from '../../../constants/coordinates.js'
import { fileUploadToEmpGeometry } from './file-upload.js'

const wgs84Geometry = (rings) => ({
  rings,
  spatialReference: SPATIAL_REFERENCES.WGS84
})

/**
 * Builds the geometries to be sent to EMP/ArcGIS as separate features.
 *
 * Manual circle sites (coordinatesEntry === 'single') are each returned as
 * their own geometry so that ArcGIS renders an individual centroid per circle
 * (ML-1222). File uploads and manual polygon sites remain grouped into a
 * single geometry, preserving existing behaviour.
 */
export const buildEmpGeometries = (siteDetails) => {
  const isFileUploadCoordinates = siteDetails.some(
    (site) => site.coordinatesType === 'file'
  )
  if (isFileUploadCoordinates) {
    return [fileUploadToEmpGeometry(siteDetails)]
  }

  const circleSites = siteDetails.filter(
    (site) => site.coordinatesEntry === 'single'
  )
  const otherSites = siteDetails.filter(
    (site) => site.coordinatesEntry !== 'single'
  )

  // Preserve behaviour for exemptions with no manual circle sites (including
  // empty siteDetails): a single feature containing the grouped rings.
  if (circleSites.length === 0) {
    return [wgs84Geometry(manualCoordsToEmpGeometry(otherSites))]
  }

  const geometries = circleSites.map((site) =>
    wgs84Geometry([manualSiteToEmpRing(site)])
  )

  if (otherSites.length > 0) {
    geometries.push(wgs84Geometry(manualCoordsToEmpGeometry(otherSites)))
  }

  return geometries
}
