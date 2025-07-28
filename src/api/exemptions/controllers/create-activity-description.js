import Boom from '@hapi/boom'
import { activityDescriptionSchema } from '../../../models/activity-description.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { authorizeOwnership } from '../helpers/authorize-ownership.js'

export const createActivityDescriptionController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership }],
    validate: {
      query: false,
      payload: activityDescriptionSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request

      const { id, activityDescription, updatedAt, updatedBy } = payload

      const result = await db
        .collection('exemptions')
        .updateOne(
          { _id: ObjectId.createFromHexString(id) },
          { $set: { activityDescription, updatedAt, updatedBy } }
        )

      if (result.matchedCount === 0) {
        throw Boom.notFound('Exemption not found')
      }

      return h
        .response({
          message: 'success'
        })
        .code(StatusCodes.CREATED)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(
        `Error creating activity description: ${error.message}`
      )
    }
  }
}
