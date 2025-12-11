import './proj4-definition-osgb34.js'
import { generateCirclePolygon } from './circle-to-polygon.js'
import { COORDINATE_SYSTEMS } from '../../../constants/coordinates.js'
import { areCoordsTheSame } from './are-coords-the-same.js'
import { singleOSGB36toWGS84 } from '../../geo/geo-utils.js'

const { OSGB36, WGS84 } = COORDINATE_SYSTEMS

export const manualCoordsToEmpGeometry = (siteDetails) => {
  return siteDetails.map((site) => {
    let coords
    if (site.coordinatesEntry === 'single') {
      coords = circleToEmp(site)
    }
    if (site.coordinatesEntry === 'multiple') {
      coords = polygonToEmp(site)
    }
    if (coords) {
      // For a polygon, the last point should be a copy of the first point
      // https://developers.arcgis.com/rest/services-reference/enterprise/geometry-objects/#polygon
      if (!areCoordsTheSame(coords[0], coords.at(-1))) {
        coords.push(coords[0])
      }
      return coords
    }
    throw new Error(`Invalid coordinatesEntry: ${site.coordinatesEntry}`)
  })
}

export const circleToEmp = (site) => {
  const { coordinateSystem, coordinates, circleWidth } = site
  if (!site.coordinates) {
    throw new Error('Coordinates missing')
  }
  if (!circleWidth) {
    throw new Error('Circle width missing')
  }
  const radiusMetres = Number.parseInt(circleWidth, 10) / 2
  if (coordinateSystem === WGS84) {
    return generateCirclePolygon({
      latitude: Number.parseFloat(coordinates.latitude),
      longitude: Number.parseFloat(coordinates.longitude),
      radiusMetres
    })
  }
  if (coordinateSystem === OSGB36) {
    const [longitude, latitude] = singleOSGB36toWGS84(coordinates)
    return generateCirclePolygon({
      latitude,
      longitude,
      radiusMetres
    })
  }
  throw new Error(`Unsupported coordinate system: ${coordinateSystem}`)
}

export const polygonToEmp = (site) => {
  if (!site.coordinates) {
    throw new Error('Coordinates missing')
  }
  if (site.coordinateSystem === WGS84) {
    return site.coordinates.map((coord) => [
      Number.parseFloat(coord.longitude),
      Number.parseFloat(coord.latitude)
    ])
  }
  if (site.coordinateSystem === OSGB36) {
    return site.coordinates.map((coords) => singleOSGB36toWGS84(coords))
  }
  throw new Error(`Unsupported coordinate system: ${site.coordinateSystem}`)
}
