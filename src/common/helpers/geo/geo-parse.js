import Boom from '@hapi/boom'
import { generateCirclePolygon } from '../emp/transforms/circle-to-polygon.js'
import { singleOSGB36toWGS84 } from './geo-utils.js'
import { outputIntersectionAreas } from './geo-search.js'

export const convertSingleCoordinates = (site) => {
  let latitude, longitude

  if (site.coordinateSystem === 'osgb36') {
    ;[longitude, latitude] = singleOSGB36toWGS84(
      site.coordinates.eastings,
      site.coordinates.northings
    )
  } else {
    latitude = Number.parseFloat(site.coordinates.latitude)
    longitude = Number.parseFloat(site.coordinates.longitude)
  }

  const radiusMetres = parseInt(site.circleWidth, 10) / 2
  const circleCoords = generateCirclePolygon({
    latitude,
    longitude,
    radiusMetres
  })

  return { type: 'Polygon', coordinates: [circleCoords] }
}

export const convertMultipleCoordinates = (site) => {
  const siteGeometries = []

  const polygonCoords = site.coordinates.map((coord) => {
    if (site.coordinateSystem === 'osgb36') {
      return singleOSGB36toWGS84(coord.eastings, coord.northings)
    } else {
      return [
        Number.parseFloat(coord.longitude),
        Number.parseFloat(coord.latitude)
      ]
    }
  })

  siteGeometries.push({
    type: 'Polygon',
    coordinates: [polygonCoords]
  })

  return siteGeometries
}

export const formatFileCoordinates = (site) => {
  if (!site.geoJSON?.features) {
    return []
  }

  return site.geoJSON.features
    .filter((feature) => feature.geometry?.coordinates)
    .map((feature) => ({
      type: feature.geometry.type,
      coordinates: feature.geometry.coordinates
    }))
}

export const parseGeoAreas = async (exemption, db, tableName) => {
  if (!exemption?.siteDetails) {
    throw Boom.notFound('Exemption with site details not found')
  }

  const { siteDetails } = exemption

  const siteGeometries = []

  for (const site of siteDetails) {
    const { coordinatesEntry, coordinatesType } = site

    if (coordinatesType === 'coordinates' && coordinatesEntry === 'single') {
      siteGeometries.push(convertSingleCoordinates(site))
    } else if (
      coordinatesType === 'coordinates' &&
      coordinatesEntry === 'multiple'
    ) {
      siteGeometries.push(...convertMultipleCoordinates(site))
    } else if (coordinatesType === 'file') {
      siteGeometries.push(...formatFileCoordinates(site))
    }
  }

  const result = await outputIntersectionAreas(db, siteGeometries, tableName)

  return result
}
