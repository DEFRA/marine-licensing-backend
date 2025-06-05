import Boom from '@hapi/boom'
import { ObjectId } from 'mongodb'
import { StatusCodes } from 'http-status-codes'
import { activityDatesSchema } from '../../../models/activity-dates.js'

export const createActivityDatesController = {
  options: {
    validate: {
      query: false,
      payload: activityDatesSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { start, end, id } = payload

      const result = await db.collection('exemptions').updateOne(
        { _id: ObjectId.createFromHexString(id) },
        {
          $set: {
            activityDates: {
              start,
              end
            }
          }
        }
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
      throw Boom.internal(`Error creating activity dates: ${error.message}`)
    }
  }
}
