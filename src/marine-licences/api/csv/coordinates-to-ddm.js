import { coordinatesToDegreesDecimalMinutes } from '../../../shared/common/helpers/geo/geo-transforms.js'

const convertPointsToDDM = ([lon, lat]) => ({
  lat: coordinatesToDegreesDecimalMinutes(lat, true),
  lon: coordinatesToDegreesDecimalMinutes(lon, false)
})

const convertSite = (ring) => ring.map(convertPointsToDDM)

/**
 * Converts a site coordinates array (output of getSiteCoordinates) to DDM format.
 *
 * - Circle/polygon sites: site of [lon, lat] pairs → site of of { lat, lon } DDM strings
 * - File upload sites: array of feature sites → same structure with DDM strings
 */
export const convertCoordinatesToDdm = (siteCoordinates) =>
  siteCoordinates.map((site) => {
    if (Array.isArray(site[0]?.[0])) {
      return site.map(convertSite)
    }
    return convertSite(site)
  })
