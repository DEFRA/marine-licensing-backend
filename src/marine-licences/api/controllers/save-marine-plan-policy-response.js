import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { marinePlanPolicyResponseSchema } from '../../models/marine-plan-policy.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'

export const saveMarinePlanPolicyResponseController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: marinePlanPolicyResponseSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { id, policyCode, response, updatedAt, updatedBy } = payload
      const _id = ObjectId.createFromHexString(id)
      const collection = db.collection(collectionMarineLicences)

      const result = await collection.updateOne(
        { _id },
        {
          $set: {
            [`marinePlanPolicyResponses.${policyCode}`]: response,
            updatedAt,
            updatedBy
          }
        }
      )

      if (result.matchedCount === 0) {
        throw Boom.notFound('Marine licence not found')
      }

      return h.response({ message: 'success' }).code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error saving policy response: ${error.message}`)
    }
  }
}
