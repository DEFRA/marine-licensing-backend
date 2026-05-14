import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { iatAnswersBody } from '../../models/iat-answers.js'
import { addCreateAuditFieldsOptional } from '../../../shared/common/helpers/mongo-audit.js'
import { collectionIatAnswers } from '../../../shared/common/constants/db-collections.js'
import { sanitiseSummaryText } from '../helpers/sanitise-summary-text.js'

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
      const sanitisedPayload = {
        ...payload,
        outcome: {
          ...payload.outcome,
          summaryText: sanitiseSummaryText(payload.outcome.summaryText)
        }
      }
      const doc = addCreateAuditFieldsOptional(auth, sanitisedPayload)
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
