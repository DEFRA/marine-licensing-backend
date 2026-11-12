import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { marinePlanPolicyDocumentTypeSchema } from '../../../models/marine-plan-policy.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../../shared/helpers/authorize-ownership.js'

export const updateMarinePlanPolicyDocumentTypeController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: marinePlanPolicyDocumentTypeSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const {
        id,
        documentId,
        documentType,
        documentTypeOther,
        updatedAt,
        updatedBy
      } = payload

      const isOther = documentType === 'other'

      const update = {
        $set: {
          'marinePlanPolicyDocuments.$.documentType': documentType,
          updatedAt,
          updatedBy
        }
      }

      if (isOther) {
        update.$set['marinePlanPolicyDocuments.$.documentTypeOther'] =
          documentTypeOther
      } else {
        update.$unset = {
          'marinePlanPolicyDocuments.$.documentTypeOther': ''
        }
      }

      const result = await db.collection(collectionMarineLicences).updateOne(
        {
          _id: ObjectId.createFromHexString(id),
          'marinePlanPolicyDocuments.documentId': documentId
        },
        update
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
        `Error updating marine plan policy document type: ${error.message}`
      )
    }
  }
}
