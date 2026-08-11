import Boom from '@hapi/boom'
import { deleteConstructionDrawingsSchema } from '../../models/site-details/delete-construction-drawings.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { versionedUpdate } from '../helpers/versionedUpdate.js'

export const deleteConstructionDrawingsController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: deleteConstructionDrawingsSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { id, siteIndex, updatedAt, updatedBy } = payload

      const constructionDrawingsPath = `siteDetails.${siteIndex}.constructionDrawings`
      const sitePath = `siteDetails.${siteIndex}`
      const _id = ObjectId.createFromHexString(id)

      const marineLicence = await db
        .collection(collectionMarineLicences)
        .findOne({ _id, [sitePath]: { $exists: true } })

      if (!marineLicence) {
        throw Boom.notFound(
          `Site not found at index ${siteIndex} for Marine Licence ${id}`
        )
      }

      await versionedUpdate({
        db,
        collectionName: collectionMarineLicences,
        id,
        _id,
        sitePath,
        expectedUpdatedAt: marineLicence.updatedAt,
        updateOps: {
          $unset: { [constructionDrawingsPath]: 1 },
          $set: { siteDetailsConfirmed: false, updatedAt, updatedBy }
        }
      })

      return h.response({ message: 'success' }).code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(
        `Error deleting construction drawings: ${error.message}`
      )
    }
  }
}
