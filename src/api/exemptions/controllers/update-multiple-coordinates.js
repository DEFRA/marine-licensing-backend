import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { multipleCoordinatesPatchSchema } from '../../../models/multiple-coordinates.js'
import { authorizeOwnership } from '../helpers/authorize-ownership.js'

export const updateMultipleCoordinatesController = {
  options: {
    pre: [{ method: authorizeOwnership }],
    validate: {
      payload: multipleCoordinatesPatchSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { coordinateSystem, coordinates, id } = payload

      const result = await db.collection('exemptions').updateOne(
        { _id: ObjectId.createFromHexString(id) },
        {
          $set: {
            multipleCoordinates: {
              coordinateSystem,
              coordinates
            }
          }
        }
      )

      if (result.matchedCount === 0) {
        throw Boom.notFound('Exemption not found')
      }

      return h
        .response({
          message: 'success',
          value: {
            id,
            coordinateSystem,
            coordinates: coordinates.length
          }
        })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error saving multiple coordinates: ${error.message}`)
    }
  }
}
