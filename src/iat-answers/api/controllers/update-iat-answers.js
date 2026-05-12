import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { iatAnswersBody, iatAnswersIdParams } from '../../models/iat-answers.js'
import { addUpdateAuditFieldsOptional } from '../../../shared/common/helpers/mongo-audit.js'
import { collectionIatAnswers } from '../../../shared/common/constants/db-collections.js'

const PAYLOAD_MAX_BYTES = 32 * 1024

export const updateIatAnswersController = {
  options: {
    auth: { mode: 'optional' },
    payload: { maxBytes: PAYLOAD_MAX_BYTES },
    validate: {
      params: iatAnswersIdParams,
      payload: iatAnswersBody
    }
  },
  handler: async (request, h) => {
    try {
      const { params, payload, db, auth } = request
      const collection = db.collection(collectionIatAnswers)
      const _id = new ObjectId(params.id)

      const existing = await collection.findOne({ _id })
      if (!existing) {
        throw Boom.notFound('IAT answers not found')
      }

      const updated = {
        ...addUpdateAuditFieldsOptional(auth, payload),
        createdAt: existing.createdAt,
        createdBy: existing.createdBy
      }

      await collection.replaceOne({ _id }, updated)
      return h.response({ message: 'success' }).code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error updating IAT answers: ${error.message}`)
    }
  }
}
