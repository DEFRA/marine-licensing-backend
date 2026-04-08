import Boom from '@hapi/boom'
import { activityDetailsSchema } from '../../models/activity-details.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'

export const addActivityDetailsController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: activityDetailsSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { id, siteIndex, updatedAt, updatedBy } = payload

      const activityDetails = {
        activityType: '',
        activityDescription: '',
        activityDuration: '',
        completionDate: '',
        activityMonths: '',
        workingHours: ''
      }

      const sitePath = `siteDetails.${siteIndex}`

      const result = await db.collection(collectionMarineLicences).updateOne(
        {
          _id: ObjectId.createFromHexString(id),
          [sitePath]: { $exists: true }
        },
        {
          $push: { [`${sitePath}.activityDetails`]: activityDetails },
          $set: { updatedAt, updatedBy }
        }
      )

      if (result.matchedCount === 0) {
        throw Boom.notFound(
          `Marine licence not found or invalid site index of ${siteIndex} for Marine Licence ${id}`
        )
      }

      return h.response({ message: 'success' }).code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(`Error adding activity details: ${error.message}`)
    }
  }
}
