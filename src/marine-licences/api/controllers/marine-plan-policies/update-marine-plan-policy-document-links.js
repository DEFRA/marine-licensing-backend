import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { marinePlanPolicyDocumentLinksSchema } from '../../../models/marine-plan-policy.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { buildMarinePlanPoliciesRequiringDocuments } from '../../helpers/marine-plan-policies/marine-plan-policy-documents-required.js'
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
      const document = marineLicence?.marinePlanPolicyDocuments?.find(
        (doc) => doc.documentId === documentId
      )

      if (!document) {
        throw Boom.notFound('Marine licence or document not found')
      }

      if (!document.documentType) {
        throw Boom.badRequest('DOCUMENT_TYPE_REQUIRED')
      }

      const requiringDocuments = buildMarinePlanPoliciesRequiringDocuments(
        marineLicence.marinePlanPolicies,
        marineLicence.marinePlanPolicyResponses
      )
      if (
        policyLinks.some(
          ({ policyCode }) => !requiringDocuments.includes(policyCode)
        )
      ) {
        throw Boom.badRequest('POLICY_CODE_INVALID')
      }

      await collection.updateOne(
        { _id, 'marinePlanPolicyDocuments.documentId': documentId },
        {
          $set: {
            'marinePlanPolicyDocuments.$.policyLinks': policyLinks,
            updatedAt,
            updatedBy
          }
        }
      )

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
