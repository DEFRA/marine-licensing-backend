import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { iatAnswersSlugParams } from '../../models/iat-answers.js'
import { addUpdateAuditFieldsOptional } from '../../../shared/common/helpers/mongo-audit.js'
import { collectionIatAnswers } from '../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'

export const publishIatAnswersController = {
  options: {
    auth: { mode: 'optional' },
    validate: {
      params: iatAnswersSlugParams
    }
  },
  handler: async (request, h) => {
    try {
      const { params, db, auth } = request
      const update = addUpdateAuditFieldsOptional(auth, { published: true })
      const result = await db
        .collection(collectionIatAnswers)
        .updateOne(
          { slug: params.slug },
          { $set: update, $unset: { expiresAt: '' } }
        )

      if (result.matchedCount === 0) {
        throw Boom.notFound('IAT answers not found')
      }

      return h.response({ message: 'success' }).code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      request.logger.error(
        structureErrorForECS(error),
        'Error publishing IAT answers'
      )
      throw Boom.internal(`Error publishing IAT answers: ${error.message}`)
    }
  }
}
