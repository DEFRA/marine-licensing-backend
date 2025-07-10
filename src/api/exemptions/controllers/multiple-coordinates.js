import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import {
  multipleCoordinatesPostSchema,
  multipleCoordinatesGetParamsSchema
} from '../../../models/multiple-coordinates.js'
import { authorizeOwnership } from '../helpers/authorize-ownership.js'

export const getMultipleCoordinatesController = {
  options: {
    pre: [{ method: authorizeOwnership }],
    validate: {
      params: multipleCoordinatesGetParamsSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { params, db } = request
      const { exemptionId } = params

      const exemption = await db
        .collection('exemptions')
        .findOne({ _id: ObjectId.createFromHexString(exemptionId) })

      if (!exemption) {
        throw Boom.notFound('Exemption not found')
      }

      const response = {
        exemptionId,
        coordinateSystem:
          exemption.multipleCoordinates?.coordinateSystem || null,
        coordinates: exemption.multipleCoordinates?.coordinates || []
      }

      return h
        .response({
          message: 'success',
          value: response
        })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(
        `Error retrieving multiple coordinates: ${error.message}`
      )
    }
  }
}

export const patchMultipleCoordinatesController = {
  options: {
    pre: [{ method: authorizeOwnership }],
    validate: {
      payload: multipleCoordinatesPostSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { coordinateSystem, coordinates, id } = payload

      const exemption = await db
        .collection('exemptions')
        .findOne({ _id: ObjectId.createFromHexString(id) })

      if (!exemption) {
        throw Boom.notFound('Exemption not found')
      }

      if (
        exemption.multipleCoordinates?.coordinateSystem &&
        exemption.multipleCoordinates.coordinateSystem !== coordinateSystem
      ) {
        throw Boom.conflict(
          `Coordinate system mismatch. Existing coordinates use ${exemption.multipleCoordinates.coordinateSystem}, but received ${coordinateSystem}`
        )
      }

      const now = new Date()

      const result = await db.collection('exemptions').updateOne(
        { _id: ObjectId.createFromHexString(id) },
        {
          $set: {
            multipleCoordinates: {
              coordinateSystem,
              coordinates,
              createdAt: exemption.multipleCoordinates?.createdAt || now,
              updatedAt: now
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
