import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { updateSiteNoticeEvidenceSchema } from '../../models/site-notice-evidence.js'
import { validateSiteNoticePhotoUpload } from '../helpers/validateSiteNoticePhotoUpload.js'

export const updateSiteNoticeEvidenceController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: updateSiteNoticeEvidenceSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { id, evidenceIndex, updatedAt, updatedBy, ...evidence } = payload
      const evidencePath = `siteNoticeEvidence.${evidenceIndex}`

      if (evidence.closeUpPhoto) {
        await validateSiteNoticePhotoUpload(evidence.closeUpPhoto.s3Location)
      }

      if (evidence.positionPhoto) {
        await validateSiteNoticePhotoUpload(evidence.positionPhoto.s3Location)
      }

      const result = await db.collection(collectionMarineLicences).updateOne(
        {
          _id: ObjectId.createFromHexString(id),
          [evidencePath]: { $exists: true }
        },
        {
          $set: {
            ...Object.fromEntries(
              Object.entries(evidence).map(([field, value]) => [
                `${evidencePath}.${field}`,
                value
              ])
            ),
            updatedAt,
            updatedBy
          }
        }
      )

      if (result.matchedCount === 0) {
        throw Boom.notFound(
          `Marine licence not found or invalid evidence index of ${evidenceIndex} for Marine Licence ${id}`
        )
      }

      return h.response({ message: 'success' }).code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(
        `Error updating site notice evidence: ${error.message}`
      )
    }
  }
}
