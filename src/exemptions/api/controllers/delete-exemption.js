import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getExemption } from '../../models/get-exemption.js'
import { ObjectId } from 'mongodb'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import { createLogger } from '../../../shared/common/helpers/logging/logger.js'

const logger = createLogger()

export const deleteExemptionController = {
  options: {
    pre: [{ method: authorizeOwnership(collectionExemptions) }],
    validate: {
      params: getExemption
    }
  },
  handler: async (request, h) => {
    try {
      const { params, db } = request

      const exemption = await db
        .collection(collectionExemptions)
        .findOne({ _id: ObjectId.createFromHexString(params.id) })

      if (!exemption) {
        throw Boom.notFound('Exemption not found')
      }

      if (exemption.status !== EXEMPTION_STATUS.DRAFT) {
        throw Boom.badRequest(
          `Cannot delete exemption as exemption must be the status '${EXEMPTION_STATUS.DRAFT}'.`
        )
      }

      await db
        .collection(collectionExemptions)
        .deleteOne({ _id: ObjectId.createFromHexString(params.id) })

      logger.info({ exemptionId: params.id }, 'Exemption deleted successfully')

      return h
        .response({ message: 'Exemption deleted successfully' })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error deleting exemption: ${error.message}`)
    }
  }
}
