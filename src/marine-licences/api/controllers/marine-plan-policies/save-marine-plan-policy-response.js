import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { marinePlanPolicyResponseSchema } from '../../../models/marine-plan-policy.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../../shared/helpers/authorize-ownership.js'
import { unlinkMarinePlanPolicyDocuments } from '../../helpers/marine-plan-policies/unlink-marine-plan-policy-documents.js'
import {
  collectS3Locations,
  deleteOrphanedS3Objects
} from '../../helpers/deleteS3Objects.js'

const NO_UNLINK = { documents: [], orphanedDocuments: [], changed: false }

const unlinkPolicy = async (collection, _id, policyCode) => {
  const marineLicence = await collection.findOne(
    { _id },
    { projection: { marinePlanPolicyDocuments: 1 } }
  )

  return unlinkMarinePlanPolicyDocuments(
    [policyCode],
    marineLicence?.marinePlanPolicyDocuments
  )
}

const updateMarineLicencePolicyResponse = async (collection, _id, policyCode, {
  response,
  requiresDocumentation,
  documents,
  changed,
  updatedAt,
  updatedBy
}) => {
  return collection.updateOne({ _id }, [
    {
      $set: {
        marinePlanPolicyResponses: {
          $mergeObjects: [
            '$marinePlanPolicyResponses',
            {
              [policyCode]: {
                $literal: { response, requiresDocumentation }
              }
            }
          ]
        },
        ...(changed && {
          marinePlanPolicyDocuments: { $literal: documents }
        }),
        updatedAt,
        updatedBy
      }
    },
    {
      $set: {
        marinePlanPolicyResponseCount: {
          $size: {
            $filter: {
              input: { $objectToArray: '$marinePlanPolicyResponses' },
              as: 'r',
              cond: { $ne: ['$$r.v.response', ''] }
            }
          }
        }
      }
    }
  ])
}

const handleOrphanedDocumentsResponse = (orphanedDocuments, confirmDocumentDeletion, h) => {
  if (orphanedDocuments.length > 0 && !confirmDocumentDeletion) {
    return h
      .response({
        message: 'success',
        value: {
          confirmationRequired: true,
          orphanedDocuments: orphanedDocuments.map((document) => ({
            documentId: document.documentId,
            filename: document.uploadedFile?.filename
          }))
        }
      })
      .code(StatusCodes.OK)
  }
  return null
}

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
      const {
        id,
        policyCode,
        response,
        requiresDocumentation,
        confirmDocumentDeletion,
        updatedAt,
        updatedBy
      } = payload
      const _id = ObjectId.createFromHexString(id)
      const collection = db.collection(collectionMarineLicences)

      const { documents, orphanedDocuments, changed } = requiresDocumentation
        ? NO_UNLINK
        : await unlinkPolicy(collection, _id, policyCode)

      const orphanedResponse = handleOrphanedDocumentsResponse(
        orphanedDocuments,
        confirmDocumentDeletion,
        h
      )
      if (orphanedResponse) return orphanedResponse

      const result = await updateMarineLicencePolicyResponse(collection, _id, policyCode, {
        response,
        requiresDocumentation,
        documents,
        changed,
        updatedAt,
        updatedBy
      })

      if (result.matchedCount === 0) {
        throw Boom.notFound('Marine licence not found')
      }

      await deleteOrphanedS3Objects(db, collectS3Locations(orphanedDocuments))

      return h.response({ message: 'success' }).code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error saving policy response: ${error.message}`)
    }
  }
}
