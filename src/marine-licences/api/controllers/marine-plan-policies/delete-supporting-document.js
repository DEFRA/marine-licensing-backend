import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { deleteMarinePlanPolicyDocumentSchema } from '../../../models/marine-plan-policy.js'
import { authorizeOwnership } from '../../../../shared/helpers/authorize-ownership.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import {
  collectS3Locations,
  deleteOrphanedS3Objects
} from '../../helpers/deleteS3Objects.js'

export const deleteSupportingDocumentController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: deleteMarinePlanPolicyDocumentSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { id, documentId, updatedAt, updatedBy } = payload

      const _id = ObjectId.createFromHexString(id)
      const collection = db.collection(collectionMarineLicences)

      const marineLicence = await collection.findOne(
        { _id },
        {
          projection: {
            marinePlanPolicyDocuments: 1,
            marinePlanPolicies: 1,
            marinePlanPolicyResponses: 1
          }
        }
      )

      if (!marineLicence) {
        throw Boom.notFound(` Marine Licence not found for ${id}`)
      }

      const document = marineLicence?.marinePlanPolicyDocuments?.find(
        (doc) => doc.documentId === documentId
      )

      if (!document) {
        throw Boom.notFound(`No document found for documentId ${documentId}`)
      }

      await collection.updateOne(
        { _id },
        {
          $pull: {
            marinePlanPolicyDocuments: { documentId }
          }
        },
        {
          $set: {
            updatedAt,
            updatedBy
          }
        }
      )

      const s3Locations = collectS3Locations(document)

      await deleteOrphanedS3Objects(db, s3Locations)

      return h.response({ message: 'success' }).code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(`Error deleting document: ${error.message}`)
    }
  }
}
