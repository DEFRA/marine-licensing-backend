import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { iatContextSlugParams } from '../../models/iat-context.js'
import { collectionIatContexts } from '../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'

export const getIatContextController = {
  options: {
    auth: { mode: 'optional' },
    validate: { params: iatContextSlugParams }
  },
  handler: async (request, h) => {
    try {
      const { params, db } = request
      const doc = await db
        .collection(collectionIatContexts)
        .findOne({ slug: params.slug })

      if (!doc) {
        throw Boom.notFound('IAT context not found or expired')
      }

      return h.response({ message: 'success', value: doc }).code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      request.logger.error(
        structureErrorForECS(error),
        'Error fetching IAT context'
      )
      throw Boom.internal(`Error fetching IAT context: ${error.message}`)
    }
  }
}
