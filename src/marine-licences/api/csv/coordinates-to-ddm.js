import { coordinatesToDegreesDecimalMinutes } from '../../../shared/common/helpers/geo/geo-transforms.js'

const convertPointsToDDM = ([lon, lat]) => ({
  lat: coordinatesToDegreesDecimalMinutes(lat, true),
  lon: coordinatesToDegreesDecimalMinutes(lon, false)
})

const convertSite = (feature) => feature.map(convertPointsToDDM)

/**
 * Converts a site coordinates array (output of getSiteCoordinates) to DDM format.
 * File upload features are flattened into a single array, matching the manual site structure.
 *
 * Both site types produce: [{ lat, lon }, ...]
 */
export const convertCoordinatesToDdm = (siteCoordinates) =>
  siteCoordinates.map((site) => {
    if (Array.isArray(site[0]?.[0])) {
      return site.flatMap(convertSite)
    }
    return convertSite(site)
  })
