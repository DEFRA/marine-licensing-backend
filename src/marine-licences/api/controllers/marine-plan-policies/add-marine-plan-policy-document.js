import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { randomUUID } from 'node:crypto'
import { addMarinePlanPolicyDocumentSchema } from '../../../models/marine-plan-policy.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../../shared/helpers/authorize-ownership.js'
import { validateMppDocumentUpload } from '../../helpers/validate-mpp-document-upload.js'

export const addMarinePlanPolicyDocumentController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: addMarinePlanPolicyDocumentSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { id, uploadedFile, s3Location, updatedAt, updatedBy } = payload

      await validateMppDocumentUpload(s3Location, uploadedFile.filename)

      const documentId = randomUUID()

      const result = await db.collection(collectionMarineLicences).updateOne(
        { _id: ObjectId.createFromHexString(id) },
        {
          $push: {
            marinePlanPolicyDocuments: {
              documentId,
              uploadedFile,
              s3Location
            }
          },
          $set: { updatedAt, updatedBy }
        }
      )

      if (result.matchedCount === 0) {
        throw Boom.notFound('Marine licence not found')
      }

      return h
        .response({ message: 'success', value: { documentId } })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(
        `Error adding marine plan policy document: ${error.message}`
      )
    }
  }
}
