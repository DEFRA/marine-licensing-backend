import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { iatAnswersBody } from '../../models/iat-answers.js'
import { addCreateAuditFieldsOptional } from '../../../shared/common/helpers/mongo-audit.js'
import { collectionIatAnswers } from '../../../shared/common/constants/db-collections.js'
import { sanitiseSummaryText } from '../helpers/sanitise-summary-text.js'
import { generateSlug } from '../helpers/generate-slug.js'

const PAYLOAD_MAX_BYTES = 32 * 1024
const DUPLICATE_KEY_CODE = 11000

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
      const slug = await insertWithSlug(db, auth, sanitisedPayload)
      return h
        .response({ message: 'success', value: { slug } })
        .code(StatusCodes.CREATED)
    } catch (error) {
      throw Boom.internal(`Error creating IAT answers: ${error.message}`)
    }
  }
}

async function insertWithSlug(db, auth, sanitisedPayload) {
  const collection = db.collection(collectionIatAnswers)
  try {
    const slug = generateSlug()
    const doc = addCreateAuditFieldsOptional(auth, {
      ...sanitisedPayload,
      slug
    })
    await collection.insertOne(doc)
    return slug
  } catch (error) {
    if (error.code === DUPLICATE_KEY_CODE) {
      const retrySlug = generateSlug()
      const retryDoc = addCreateAuditFieldsOptional(auth, {
        ...sanitisedPayload,
        slug: retrySlug
      })
      await collection.insertOne(retryDoc)
      return retrySlug
    }
    throw error
  }
}
