import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { feeEstimateSchema } from '../../models/fee-estimate.js'

export const updateFeeEstimateController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: feeEstimateSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request

      const { accept, termsAndConditions, feeBand, id, updatedAt, updatedBy } =
        payload

      const result = await db.collection(collectionMarineLicences).updateOne(
        { _id: ObjectId.createFromHexString(id) },
        {
          $set: {
            feeEstimate: { accept, termsAndConditions, feeBand },
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
      throw Boom.internal(`Error updating fee estimate: ${error.message}`)
    }
  }
}
