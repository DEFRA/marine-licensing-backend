import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { outcomeDocumentSlugParams } from '../../models/iat-outcome-document.js'
import { collectionIatOutcomeDocuments } from '../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'

export const getOutcomeDocumentController = {
  options: {
    auth: { mode: 'optional' },
    validate: { params: outcomeDocumentSlugParams }
  },
  handler: async (request, h) => {
    try {
      const { params, db } = request
      const doc = await db
        .collection(collectionIatOutcomeDocuments)
        .findOne({ slug: params.slug })

      if (!doc) {
        throw Boom.notFound('Outcome document not found')
      }

      const { _id, ...rest } = doc
      return h
        .response({ message: 'success', value: rest })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      request.logger.error(
        structureErrorForECS(error),
        'Error fetching outcome document'
      )
      throw Boom.internal(`Error fetching outcome document: ${error.message}`)
    }
  }
}
