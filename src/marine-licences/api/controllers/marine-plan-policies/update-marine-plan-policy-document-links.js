import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { marinePlanPolicyDocumentLinksSchema } from '../../../models/marine-plan-policy.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../../shared/helpers/authorize-ownership.js'

export const updateMarinePlanPolicyDocumentLinksController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: marinePlanPolicyDocumentLinksSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { id, documentId, policyLinks, updatedAt, updatedBy } = payload

      const result = await db.collection(collectionMarineLicences).updateOne(
        {
          _id: ObjectId.createFromHexString(id),
          'marinePlanPolicyDocuments.documentId': documentId
        },
        {
          $set: {
            'marinePlanPolicyDocuments.$.policyLinks': policyLinks,
            updatedAt,
            updatedBy
          }
        }
      )

      if (result.matchedCount === 0) {
        throw Boom.notFound('Marine licence or document not found')
      }

      return h.response({ message: 'success' }).code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(
        `Error updating marine plan policy document links: ${error.message}`
      )
    }
  }
}
