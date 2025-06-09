import Boom from '@hapi/boom'
import { siteDetailsSchema } from '../../../models/site-details/site-details.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'

export const updateSiteDetailsController = {
  options: {
    validate: {
      query: false,
      payload: siteDetailsSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request

      const { siteDetails, id } = payload

      const result = await db
        .collection('exemptions')
        .updateOne(
          { _id: ObjectId.createFromHexString(id) },
          { $set: { siteDetails } }
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
