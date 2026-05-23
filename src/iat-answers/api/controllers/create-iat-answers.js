import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { addCreateAuditFieldsOptional } from '../../../shared/common/helpers/mongo-audit.js'
import { collectionIatAnswers } from '../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'
import { generateSlug } from '../helpers/generate-slug.js'

const DUPLICATE_KEY_CODE = 11000

export const createIatAnswersController = {
  options: {
    auth: { mode: 'optional' },
    payload: { parse: false }
  },
  handler: async (request, h) => {
    try {
      const ttlMs = request.server.settings.app.config.get('iat.inFlightTtlMs')
      const expiresAt = new Date(Date.now() + ttlMs)
      const slug = await insertWithSlug(request.db, request.auth, expiresAt)
      return h
        .response({ message: 'success', value: { slug } })
        .code(StatusCodes.CREATED)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      request.logger.error(
        structureErrorForECS(error),
        'Error creating IAT answers'
      )
      throw Boom.internal(`Error creating IAT answers: ${error.message}`)
    }
  }
}

async function insertWithSlug(db, auth, expiresAt) {
  const collection = db.collection(collectionIatAnswers)
  const baseDoc = { answers: [], published: false, expiresAt }
  try {
    const slug = generateSlug()
    await collection.insertOne(
      addCreateAuditFieldsOptional(auth, { ...baseDoc, slug })
    )
    return slug
  } catch (error) {
    if (error.code === DUPLICATE_KEY_CODE) {
      const retrySlug = generateSlug()
      await collection.insertOne(
        addCreateAuditFieldsOptional(auth, { ...baseDoc, slug: retrySlug })
      )
      return retrySlug
    }
    throw error
  }
}
