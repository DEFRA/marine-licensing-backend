import { generateCirclePolygon } from '../../../shared/common/helpers/emp/transforms/circle-to-polygon.js'
import { singleOSGB36toWGS84 } from '../../../shared/common/helpers/geo/geo-utils.js'
import { COORDINATE_SYSTEMS } from '../../../shared/common/constants/coordinates.js'

const { WGS84 } = COORDINATE_SYSTEMS

const circleToCoords = (site) => {
  const { coordinateSystem, coordinates, circleWidth } = site
  const radiusMetres = Number.parseInt(circleWidth, 10) / 2

  if (coordinateSystem === WGS84) {
    return generateCirclePolygon({
      latitude: Number.parseFloat(coordinates.latitude),
      longitude: Number.parseFloat(coordinates.longitude),
      radiusMetres
    })
  }

  const [longitude, latitude] = singleOSGB36toWGS84(coordinates)
  return generateCirclePolygon({ latitude, longitude, radiusMetres })
}

const polygonToCoords = (site) => {
  const { coordinateSystem, coordinates } = site

  if (coordinateSystem === WGS84) {
    return coordinates.map((coord) => [
      Number.parseFloat(coord.longitude),
      Number.parseFloat(coord.latitude)
    ])
  }

  return coordinates.map((coord) => singleOSGB36toWGS84(coord))
}

const fileUploadToCoords = (site) =>
  site.geoJSON.features.map((feature) => feature.geometry.coordinates)

/**
 * Returns one element per site, preserving site grouping for CSV row generation.
 * - Circle/polygon sites: WGS84 [lon, lat] coordinate array
 * - File upload sites: array of coordinate arrays, one per GeoJSON feature
 */
export const getSiteCoordinates = (siteDetails = []) =>
  siteDetails.reduce((acc, site) => {
    if (site.coordinatesType === 'file') {
      return [...acc, fileUploadToCoords(site)]
    }

    if (site.coordinatesEntry === 'single') {
      return [...acc, circleToCoords(site)]
    }

    if (site.coordinatesEntry === 'multiple') {
      return [...acc, polygonToCoords(site)]
    }

    return acc
  }, [])
