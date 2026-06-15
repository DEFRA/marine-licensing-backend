import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { policyResponseSchema } from '../../models/policy-response.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'

export const savePolicyResponseController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: policyResponseSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { id, policyCode, response, updatedAt, updatedBy } = payload
      const _id = ObjectId.createFromHexString(id)
      const collection = db.collection(collectionMarineLicences)

      // Update in place when a response for this policy already exists…
      const updateResult = await collection.updateOne(
        { _id, 'policyResponses.policyCode': policyCode },
        {
          $set: {
            'policyResponses.$.response': response,
            updatedAt,
            updatedBy
          }
        }
      )

      // …otherwise append a new entry
      if (updateResult.matchedCount === 0) {
        const pushResult = await collection.updateOne(
          { _id },
          {
            $push: { policyResponses: { policyCode, response } },
            $set: { updatedAt, updatedBy }
          }
        )
        if (pushResult.matchedCount === 0) {
          throw Boom.notFound('Marine licence not found')
        }
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
