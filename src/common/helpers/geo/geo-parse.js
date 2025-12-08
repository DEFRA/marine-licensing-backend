import Boom from '@hapi/boom'
import { generateCirclePolygon } from '../emp/transforms/circle-to-polygon.js'
import { singleOSGB36toWGS84 } from './geo-utils.js'
import { outputIntersectionAreas } from './geo-search.js'

export const convertSingleCoordinates = (site) => {
  const siteGeometries = []
  let latitude, longitude

  if (site.coordinateSystem === 'osgb36') {
    ;[longitude, latitude] = singleOSGB36toWGS84(
      site.coordinates.eastings,
      site.coordinates.northings
    )
  } else {
    latitude = parseFloat(site.coordinates.latitude)
    longitude = parseFloat(site.coordinates.longitude)
  }

  const radiusMetres = parseInt(site.circleWidth, 10) / 2
  const circleCoords = generateCirclePolygon({
    latitude,
    longitude,
    radiusMetres
  })

  siteGeometries.push({
    type: 'Polygon',
    coordinates: [circleCoords]
  })

  return siteGeometries
}

export const parseGeoAreas = async (exemption, db, tableName) => {
  if (!exemption?.siteDetails) {
    throw Boom.notFound('Exemption with site details not found')
  }

  const { siteDetails } = exemption

  const siteGeometries = []

  for (const site of siteDetails) {
    const { coordinatesEntry, coordinatesType } = site

    // Circular Coordinates - Next add Polygon and File.
    if (coordinatesType === 'coordinates' && coordinatesEntry === 'single') {
      siteGeometries.push(...convertSingleCoordinates(site))
    }
  }

  const result = await outputIntersectionAreas(db, siteGeometries, tableName)

  return result
}
