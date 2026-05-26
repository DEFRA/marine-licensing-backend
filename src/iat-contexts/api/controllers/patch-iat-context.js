import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import {
  iatContextSlugParams,
  iatContextPatchBody
} from '../../models/iat-context.js'
import { addUpdateAuditFieldsOptional } from '../../../shared/common/helpers/mongo-audit.js'
import { collectionIatContexts } from '../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'

export const patchIatContextController = {
  options: {
    auth: { mode: 'optional' },
    validate: {
      params: iatContextSlugParams,
      payload: iatContextPatchBody
    }
  },
  handler: async (request, h) => {
    try {
      const { params, payload, db, auth } = request
      const collection = db.collection(collectionIatContexts)
      const now = new Date()

      const existing = await collection.findOne({ slug: params.slug })
      if (!existing) {
        throw Boom.notFound('IAT context not found or expired')
      }

      const newEntry = { ...payload.answer, answeredAt: now }
      const questionLog = mergeAnswer(existing.questionLog ?? [], newEntry)

      const update = addUpdateAuditFieldsOptional(auth, { questionLog })
      const result = await collection.updateOne(
        { slug: params.slug },
        { $set: update }
      )

      if (result.matchedCount === 0) {
        throw Boom.notFound('IAT context not found or expired')
      }

      return h
        .response({
          message: 'success',
          value: { questionLogLength: questionLog.length }
        })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      request.logger.error(
        structureErrorForECS(error),
        'Error patching IAT context'
      )
      throw Boom.internal(`Error patching IAT context: ${error.message}`)
    }
  }
}

function mergeAnswer(existing, newEntry) {
  const idx = existing.findIndex(
    (e) => e.questionRoute === newEntry.questionRoute
  )
  if (idx === -1) {
    return [...existing, newEntry]
  }
  return [...existing.slice(0, idx), newEntry]
}
