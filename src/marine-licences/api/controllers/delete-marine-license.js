import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getMarineLicense } from '../../models/get-marine-license.js'
import { ObjectId } from 'mongodb'
import { collectionMarineLicenses } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { MARINE_LICENSE_STATUS } from '../../constants/marine-license.js'
import { createLogger } from '../../../shared/common/helpers/logging/logger.js'

const logger = createLogger()

export const deleteMarineLicenseController = {
  options: {
    pre: [{ method: authorizeOwnership(collectionMarineLicenses) }],
    validate: {
      params: getMarineLicense
    }
  },
  handler: async (request, h) => {
    try {
      const { params, db } = request

      const marineLicense = await db
        .collection(collectionMarineLicenses)
        .findOne({ _id: ObjectId.createFromHexString(params.id) })

      if (!marineLicense) {
        throw Boom.notFound('Marine license not found')
      }

      if (marineLicense.status !== MARINE_LICENSE_STATUS.DRAFT) {
        throw Boom.badRequest(
          `Cannot delete marine license as marine license must be the status '${MARINE_LICENSE_STATUS.DRAFT}'.`
        )
      }

      await db
        .collection(collectionMarineLicenses)
        .deleteOne({ _id: ObjectId.createFromHexString(params.id) })

      logger.info(
        { marineLicenseId: params.id },
        'Marine license deleted successfully'
      )

      return h
        .response({ message: 'Marine license deleted successfully' })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error deleting marine license: ${error.message}`)
    }
  }
}
