import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { APPLICATION_TASK_TYPE } from '../../constants/marine-licence.js'
import { marineLicenceId } from '../../models/shared-models.js'
import joi from 'joi'

export const sendSiteNoticeEvidenceSchema = joi.object(marineLicenceId)

export const sendSiteNoticeEvidenceController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      payload: sendSiteNoticeEvidenceSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { id } = payload

      const now = new Date()

      const result = await db.collection(collectionMarineLicences).updateOne(
        {
          _id: ObjectId.createFromHexString(id),
          applicationTasks: {
            $elemMatch: {
              type: APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE,
              resolvedAt: null
            }
          }
        },
        {
          $set: {
            updatedAt: now,
            'applicationTasks.$.evidenceCompletedAt': now
          }
        }
      )

      if (result.matchedCount === 0) {
        throw Boom.notFound(
          'Marine licence not found or no outstanding PUBLIC_SITE_NOTICE task'
        )
      }

      return h.response({ message: 'success' }).code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(
        `Error sending site notice evidence: ${error.message}`
      )
    }
  }
}
