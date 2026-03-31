import Boom from '@hapi/boom'
import { siteDetailsSchema } from '../../models/site-details/site-details.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { tenMegaBytes } from '../../../shared/constants/site-details.js'

export const updateSiteDetailsController = {
  options: {
    payload: {
      parse: true,
      output: 'data',
      maxBytes: tenMegaBytes
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: siteDetailsSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request

      const { multipleSiteDetails, siteDetails, id, updatedAt, updatedBy } =
        payload

      const result = await db.collection(collectionMarineLicences).updateOne(
        { _id: ObjectId.createFromHexString(id) },
        {
          $set: {
            multipleSiteDetails,
            siteDetails,
            updatedAt,
            updatedBy
          }
        }
      )

      if (result.matchedCount === 0) {
        throw Boom.notFound('Marine licence not found')
      }

      return h
        .response({
          message: 'success'
        })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(`Error updating site details: ${error.message}`)
    }
  }
}
