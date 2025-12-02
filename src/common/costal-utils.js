import { generateCirclePolygon } from './helpers/emp/transforms/circle-to-polygon.js'
import proj4 from 'proj4'
import './helpers/emp/transforms/proj4-definition-osgb34.js'
import * as turf from '@turf/turf'

// Applies a 50m buffer to a GeoJSON geometry and returns the buffered geometry
const bufferGeometry = (geometry) => {
  try {
    let turfFeature

    // Convert geometry to Turf feature
    if (geometry.type === 'Polygon') {
      turfFeature = turf.polygon(geometry.coordinates)
    } else {
      return geometry
    }

    const buffered = turf.buffer(turfFeature, 50, { units: 'meters' })

    return buffered.geometry
  } catch (error) {
    return geometry
  }
}

export const outputIntersectionAreas = async (
  db,
  siteGeometries,
  siteIndex,
  collectionName = 'experiment-coastal-areas'
) => {
  const result = []

  for (const geometry of siteGeometries) {
    try {
      const bufferedGeometry = bufferGeometry(geometry)

      const intersectingAreas = await db
        .collection(collectionName)
        .find(
          {
            geometry: {
              $geoIntersects: {
                $geometry: bufferedGeometry
              }
            }
          },
          {
            projection: { info: 1, _id: 0 }
          }
        )
        .toArray()

      for (const area of intersectingAreas) {
        result.push({
          site: siteIndex,
          coastalArea: area.info
        })
      }

      break
    } catch (error) {
      continue
    }
  }

  return result
}

export const convertSingleCoords = (site) => {
  const siteGeometries = []
  let latitude, longitude

  // Handle OSGB36 conversion
  if (site.coordinateSystem === 'osgb36') {
    ;[longitude, latitude] = proj4('OSGB36', 'WGS84', [
      parseFloat(site.coordinates.eastings),
      parseFloat(site.coordinates.northings)
    ])
  } else {
    // WGS84
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

export const convertPolyCoords = (site) => {
  let coords
  const siteGeometries = []

  // Handle OSGB36 conversion
  if (site.coordinateSystem === 'osgb36') {
    coords = site.coordinates.map((c) => {
      return proj4('OSGB36', 'WGS84', [
        parseFloat(c.eastings),
        parseFloat(c.northings)
      ])
    })
  } else {
    // WGS84
    coords = site.coordinates.map((c) => [
      parseFloat(c.longitude),
      parseFloat(c.latitude)
    ])
  }

  // Ensure polygon is closed
  const firstCoord = coords[0]
  const lastCoord = coords[coords.length - 1]
  if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
    coords.push(firstCoord)
  }

  siteGeometries.push({
    type: 'Polygon',
    coordinates: [coords]
  })

  return siteGeometries
}
