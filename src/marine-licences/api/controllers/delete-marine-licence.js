import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getMarineLicence } from '../../models/get-marine-licence.js'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { createLogger } from '../../../shared/common/helpers/logging/logger.js'

const logger = createLogger()

export const deleteMarineLicenceController = {
  options: {
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      params: getMarineLicence
    }
  },
  handler: async (request, h) => {
    try {
      const { params, db } = request
      const _id = ObjectId.createFromHexString(params.id)

      // Status guard in the delete filter so a concurrent submit cannot
      // land between a status check and the delete.
      const { deletedCount } = await db
        .collection(collectionMarineLicences)
        .deleteOne({ _id, status: MARINE_LICENCE_STATUS.DRAFT })

      if (deletedCount === 0) {
        const marineLicence = await db
          .collection(collectionMarineLicences)
          .findOne({ _id })

        if (!marineLicence) {
          throw Boom.notFound('Marine licence not found')
        }

        throw Boom.badRequest(
          `Cannot delete marine licence as marine licence must be the status '${MARINE_LICENCE_STATUS.DRAFT}'.`
        )
      }

      logger.info(
        { event: { action: 'delete', outcome: 'success' } },
        `Marine licence deleted successfully: ${params.id}`
      )

      return h
        .response({ message: 'Marine licence deleted successfully' })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error deleting marine licence: ${error.message}`)
    }
  }
}
