import Boom from '@hapi/boom'
import { updateConstructionDrawingSchema } from '../../models/site-details/update-construction-drawing.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { validateConstructionDrawingUpload } from '../helpers/validateConstructionDrawingUpload.js'

export const updateConstructionDrawingController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: updateConstructionDrawingSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const {
        id,
        siteIndex,
        drawingIndex,
        filename,
        s3Location,
        updatedAt,
        updatedBy
      } = payload

      await validateConstructionDrawingUpload(s3Location)

      const _id = ObjectId.createFromHexString(id)
      const sitePath = `siteDetails.${siteIndex}`
      const drawingPath = `${sitePath}.constructionDrawings.${drawingIndex}`

      const marineLicence = await db
        .collection(collectionMarineLicences)
        .findOne({ _id }, { projection: { siteDetails: 1 } })

      const site = marineLicence?.siteDetails?.[siteIndex]
      const constructionDrawingsCount = site?.constructionDrawings?.length ?? 0
      const isValidDrawingIndex =
        drawingIndex === 0 || drawingIndex < constructionDrawingsCount

      if (!site || !isValidDrawingIndex) {
        throw Boom.notFound(
          `Marine licence not found or invalid site index of ${siteIndex} or drawing index of ${drawingIndex} for Marine Licence ${id}`
        )
      }

      // Mongo's $set does not auto-vivify arrays for a purely-numeric dotted
      // path - if constructionDrawings doesn't exist yet, `$set` on
      // "constructionDrawings.0" creates it as a plain object ({ "0": ... })
      // rather than an array, which then breaks any later $push. Only safe
      // to $set the specific index once the array already exists.
      const constructionDrawingsPath = `${sitePath}.constructionDrawings`
      const update =
        constructionDrawingsCount === 0
          ? { [constructionDrawingsPath]: [{ filename, s3Location }] }
          : { [drawingPath]: { filename, s3Location } }

      await db.collection(collectionMarineLicences).updateOne(
        { _id },
        {
          $set: {
            ...update,
            siteDetailsConfirmed: false,
            updatedAt,
            updatedBy
          }
        }
      )

      return h.response({ message: 'success' }).code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(
        `Error updating construction drawing: ${error.message}`
      )
    }
  }
}
