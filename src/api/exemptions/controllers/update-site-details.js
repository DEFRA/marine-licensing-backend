import Boom from '@hapi/boom'
import { siteDetailsSchema } from '../../../models/site-details/site-details.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionExemptions } from '../../../common/constants/db-collections.js'
import { authorizeOwnership } from '../../helpers/authorize-ownership.js'

// We found a valid real-life 23-site Shapefile that had 4MB of site data in the exemption (mostly geoJSON).10MB
// was chosen as a reasonable limit to accommodate this file, with a decent overhead for contingency while not
// overloading the server.
const tenMegaBytes = 10 * 1000 * 1000

export const updateSiteDetailsController = {
  options: {
    payload: {
      parse: true,
      output: 'data',
      maxBytes: tenMegaBytes
    },
    pre: [{ method: authorizeOwnership(collectionExemptions) }],
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

      const result = await db.collection(collectionExemptions).updateOne(
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

      throw Boom.internal(`Error updating site details: ${error.message}`)
    }
  }
}
