import Boom from '@hapi/boom'
import { updateSiteSchema } from '../../models/site-details/update-site.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'

export const updateSiteController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: updateSiteSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { id, siteIndex, siteDetails, updatedAt, updatedBy } = payload
      const sitePath = `siteDetails.${siteIndex}`

      const result = await db.collection(collectionMarineLicences).updateOne(
        {
          _id: ObjectId.createFromHexString(id),
          [sitePath]: { $exists: true }
        },
        {
          $set: { [sitePath]: siteDetails, updatedAt, updatedBy }
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

      throw Boom.internal(`Error updating site: ${error.message}`)
    }
  }
}
