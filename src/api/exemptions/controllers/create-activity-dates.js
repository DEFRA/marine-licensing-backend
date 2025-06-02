import Boom from '@hapi/boom'
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

      const result = await db.collection('exemptions').insertOne({
        activityStartDate: payload.activityStartDate,
        activityEndDate: payload.activityEndDate
      })

      return h
        .response({
          message: 'success',
          value: { id: result.insertedId.toString() }
        })
        .code(201)
        .code(StatusCodes.CREATED)
    } catch (error) {
      throw Boom.internal(`Error creating activity dates: ${error.message}`)
    }
  }
}
