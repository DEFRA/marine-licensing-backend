import Boom from '@hapi/boom'
import { activityDescriptionSchema } from '../../../models/activity-description.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'

export const createActivityDescriptionController = {
  options: {
    validate: {
      query: false,
      payload: activityDescriptionSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request

      const { id, activityDescription } = payload

      const result = await db
        .collection('exemptions')
        .updateOne(
          { _id: ObjectId.createFromHexString(id) },
          { $set: { activityDescription } }
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
