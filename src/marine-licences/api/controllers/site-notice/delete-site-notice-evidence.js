import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../../shared/helpers/authorize-ownership.js'
import { deleteSiteNoticeEvidenceSchema } from '../../../models/site-notice-evidence.js'

export const deleteSiteNoticeEvidenceController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: deleteSiteNoticeEvidenceSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { id, evidenceIndex, updatedAt, updatedBy } = payload

      const evidencePath = `siteNoticeEvidence.${evidenceIndex}`
      const _id = ObjectId.createFromHexString(id)

      const marineLicence = await db
        .collection(collectionMarineLicences)
        .findOne({ _id, [evidencePath]: { $exists: true } })

      if (!marineLicence) {
        throw Boom.notFound(
          `Site notice evidence not found for evidence index ${evidenceIndex} for Marine Licence ${id}`
        )
      }

      const result = await db
        .collection(collectionMarineLicences)
        .updateOne({ _id, updatedAt: marineLicence.updatedAt }, [
          {
            $set: {
              siteNoticeEvidence: {
                $concatArrays: [
                  { $slice: ['$siteNoticeEvidence', evidenceIndex] },
                  {
                    $slice: [
                      '$siteNoticeEvidence',
                      evidenceIndex + 1,
                      { $size: '$siteNoticeEvidence' }
                    ]
                  }
                ]
              },
              updatedAt,
              updatedBy
            }
          }
        ])

      if (result.matchedCount === 0) {
        throw Boom.conflict(
          `Marine Licence ${id} was modified by another user. Please reload and try again.`
        )
      }

      return h.response({ message: 'success' }).code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(
        `Error deleting site notice evidence: ${error.message}`
      )
    }
  }
}
