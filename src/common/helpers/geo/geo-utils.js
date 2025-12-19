import proj4 from 'proj4'
import { buffer } from '@turf/turf'
import Boom from '@hapi/boom'

export const singleOSGB36toWGS84 = ({ eastings, northings }) =>
  proj4('OSGB36', 'WGS84', [
    Number.parseFloat(eastings),
    Number.parseFloat(northings)
  ])

export const addBufferToShape = (geometry, amount = 50) => {
  try {
    const buffered = buffer(geometry, amount, { units: 'meters' })
    return buffered.geometry
  } catch (error) {
    throw Boom.badImplementation(
      `Error adding buffer to shape: ${error.message}`
    )
  }
}
