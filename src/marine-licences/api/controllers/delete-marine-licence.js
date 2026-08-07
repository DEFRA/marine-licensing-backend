import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getMarineLicence } from '../../models/get-marine-licence.js'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { createLogger } from '../../../shared/common/helpers/logging/logger.js'
import {
  collectS3Locations,
  deleteOrphanedS3Objects
} from '../helpers/deleteS3Objects.js'

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
      const marineLicence = await db
        .collection(collectionMarineLicences)
        .findOne({ _id: ObjectId.createFromHexString(params.id) })

      if (marineLicence.status !== MARINE_LICENCE_STATUS.DRAFT) {
        throw Boom.badRequest(
          `Cannot delete marine licence as marine licence must be the status '${MARINE_LICENCE_STATUS.DRAFT}'.`
        )
      }

      // Picks up every construction drawing plus the water framework directive
      // document in one sweep
      const s3Locations = collectS3Locations(marineLicence)

      await db
        .collection(collectionMarineLicences)
        .deleteOne({ _id: ObjectId.createFromHexString(params.id) })

      await deleteOrphanedS3Objects(db, s3Locations)

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
