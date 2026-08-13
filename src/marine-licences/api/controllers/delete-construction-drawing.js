import Boom from '@hapi/boom'
import { deleteConstructionDrawingSchema } from '../../models/site-details/delete-construction-drawing.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { versionedUpdate } from '../helpers/versionedUpdate.js'
import {
  collectS3Locations,
  deleteOrphanedS3Objects
} from '../helpers/deleteS3Objects.js'

export const deleteConstructionDrawingController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: deleteConstructionDrawingSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { id, siteIndex, drawingIndex, updatedAt, updatedBy } = payload

      const constructionDrawingsPath = `siteDetails.${siteIndex}.constructionDrawings`
      const drawingPath = `${constructionDrawingsPath}.${drawingIndex}`
      const sitePath = `siteDetails.${siteIndex}`
      const _id = ObjectId.createFromHexString(id)

      const marineLicence = await db
        .collection(collectionMarineLicences)
        .findOne({ _id, [drawingPath]: { $exists: true } })

      if (!marineLicence) {
        throw Boom.notFound(
          `Construction Drawing not found for site ${siteIndex} and drawing ${drawingIndex} for Marine Licence ${id}`
        )
      }

      const s3Locations = collectS3Locations(
        marineLicence.siteDetails?.[siteIndex]?.constructionDrawings?.[
          drawingIndex
        ]
      )

      // updatedAt here is used as a version to prevent collisions and users deleting other drawings
      await versionedUpdate({
        db,
        collectionName: collectionMarineLicences,
        id,
        _id,
        sitePath,
        expectedUpdatedAt: marineLicence.updatedAt,
        updateOps: {
          $unset: { [drawingPath]: 1 },
          $set: { siteDetailsConfirmed: false, updatedAt, updatedBy }
        }
      })

      await db
        .collection(collectionMarineLicences)
        .updateOne({ _id }, { $pull: { [constructionDrawingsPath]: null } })

      await deleteOrphanedS3Objects(db, s3Locations)

      return h.response({ message: 'success' }).code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(
        `Error deleting construction drawing: ${error.message}`
      )
    }
  }
}
