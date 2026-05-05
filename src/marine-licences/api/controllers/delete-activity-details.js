import Boom from '@hapi/boom'
import { deleteActivityDetailsSchema } from '../../models/activity-details/delete-activity-details.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'

export const deleteActivityDetailsController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: deleteActivityDetailsSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { id, siteIndex, activityIndex, updatedAt, updatedBy } = payload

      const activityDetailsPath = `siteDetails.${siteIndex}.activityDetails`
      const activityPath = `${activityDetailsPath}.${activityIndex}`
      const sitePath = `siteDetails.${siteIndex}`
      const _id = ObjectId.createFromHexString(id)

      const marineLicence = await db
        .collection(collectionMarineLicences)
        .findOne({ _id, [activityPath]: { $exists: true } })

      if (!marineLicence) {
        throw Boom.notFound(
          `Activity Details not found for site ${siteIndex} and activity ${activityIndex} for Marine Licence ${id}`
        )
      }

      // updatedAt here is used as a version to prevent collisions and users deleting other activities
      const unsetResult = await db
        .collection(collectionMarineLicences)
        .updateOne(
          {
            _id,
            [sitePath]: { $exists: true },
            updatedAt: marineLicence.updatedAt
          },
          { $unset: { [activityPath]: 1 }, $set: { updatedAt, updatedBy } }
        )

      if (unsetResult.matchedCount === 0) {
        throw Boom.conflict(
          `Marine Licence ${id} was modified by another user. Please reload and try again.`
        )
      }

      await db
        .collection(collectionMarineLicences)
        .updateOne({ _id }, { $pull: { [activityDetailsPath]: null } })

      return h.response({ message: 'success' }).code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(`Error deleting activity details: ${error.message}`)
    }
  }
}
