import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { iatAnswersBody } from '../../models/iat-answers.js'
import { addCreateAuditFieldsOptional } from '../../../shared/common/helpers/mongo-audit.js'
import { collectionIatAnswers } from '../../../shared/common/constants/db-collections.js'

const PAYLOAD_MAX_BYTES = 32 * 1024

export const createIatAnswersController = {
  options: {
    auth: { mode: 'optional' },
    payload: { maxBytes: PAYLOAD_MAX_BYTES },
    validate: {
      payload: iatAnswersBody
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db, auth } = request
      const doc = addCreateAuditFieldsOptional(auth, payload)
      const result = await db.collection(collectionIatAnswers).insertOne(doc)
      return h
        .response({
          message: 'success',
          value: { id: result.insertedId.toString() }
        })
        .code(StatusCodes.CREATED)
    } catch (error) {
      throw Boom.internal(`Error creating IAT answers: ${error.message}`)
    }
  }
}
