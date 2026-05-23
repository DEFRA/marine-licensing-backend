import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import {
  iatAnswersSlugParams,
  iatAnswersPatchBody
} from '../../models/iat-answers.js'
import { addUpdateAuditFieldsOptional } from '../../../shared/common/helpers/mongo-audit.js'
import { collectionIatAnswers } from '../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'

export const patchIatAnswersController = {
  options: {
    auth: { mode: 'optional' },
    validate: {
      params: iatAnswersSlugParams,
      payload: iatAnswersPatchBody
    }
  },
  handler: async (request, h) => {
    try {
      const { params, payload, db, auth } = request
      const update = addUpdateAuditFieldsOptional(auth, {
        answers: payload.answers
      })
      const result = await db
        .collection(collectionIatAnswers)
        .updateOne({ slug: params.slug, published: false }, { $set: update })

      if (result.matchedCount === 0) {
        throw Boom.notFound('IAT answers not found or already published')
      }

      return h.response({ message: 'success' }).code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      request.logger.error(
        structureErrorForECS(error),
        'Error patching IAT answers'
      )
      throw Boom.internal(`Error patching IAT answers: ${error.message}`)
    }
  }
}
