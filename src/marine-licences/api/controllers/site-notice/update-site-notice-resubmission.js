import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../../shared/helpers/authorize-ownership.js'
import { createLogger } from '../../../../shared/common/helpers/logging/logger.js'
import { APPLICATION_TASK_TYPE } from '../../../constants/marine-licence.js'
import { updateSiteNoticeResubmissionSchema } from '../../../models/resubmit-site-notice-evidence.js'
import { validateSiteNoticePhotoUpload } from '../../helpers/validateSiteNoticePhotoUpload.js'

const logger = createLogger()

// The photo is stored on the resubmission task rather than over the original evidence,
// so each round keeps what the applicant sent in it.
export const updateSiteNoticeResubmissionController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: updateSiteNoticeResubmissionSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { id, taskId, locationNumber, updatedAt, updatedBy, ...photos } =
        payload
      const locationPath = 'applicationTasks.$[task].data.locations.$[location]'

      if (photos.closeUpPhoto) {
        await validateSiteNoticePhotoUpload(
          photos.closeUpPhoto.s3Location,
          logger
        )
      }

      if (photos.positionPhoto) {
        await validateSiteNoticePhotoUpload(
          photos.positionPhoto.s3Location,
          logger
        )
      }

      const result = await db.collection(collectionMarineLicences).updateOne(
        {
          _id: ObjectId.createFromHexString(id),
          applicationTasks: {
            $elemMatch: {
              taskId,
              type: APPLICATION_TASK_TYPE.RESUBMIT_SITE_NOTICE_EVIDENCE,
              resolvedAt: null,
              'data.locations.locationNumber': locationNumber
            }
          }
        },
        {
          $set: {
            ...Object.fromEntries(
              Object.entries(photos).map(([field, photo]) => [
                `${locationPath}.${field}`,
                photo
              ])
            ),
            updatedAt,
            updatedBy
          }
        },
        {
          arrayFilters: [
            { 'task.taskId': taskId },
            { 'location.locationNumber': locationNumber }
          ]
        }
      )

      if (result.matchedCount === 0) {
        throw Boom.notFound(
          `No outstanding resubmission task ${taskId} with location ${locationNumber} on Marine Licence ${id}`
        )
      }

      return h.response({ message: 'success' }).code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(
        `Error updating site notice resubmission: ${error.message}`
      )
    }
  }
}
