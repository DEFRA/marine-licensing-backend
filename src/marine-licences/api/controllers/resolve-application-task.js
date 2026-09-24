import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { resolveApplicationTask } from '../../models/resolve-application-task.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { getContactId } from '../../../shared/helpers/get-contact-id.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

const markTaskResolved = (taskId, resolvedAt) => ({
  $set: {
    applicationTasks: {
      $map: {
        input: '$applicationTasks',
        as: 'task',
        in: {
          $cond: [
            { $eq: ['$$task.taskId', taskId] },
            { $mergeObjects: ['$$task', { resolvedAt }] },
            '$$task'
          ]
        }
      }
    }
  }
})

const buildResolvePipeline = (taskId, resolvedAt, resolvedBy) => [
  markTaskResolved(taskId, resolvedAt),
  { $set: { updatedAt: resolvedAt, updatedBy: resolvedBy } }
]

export const resolveApplicationTaskController = {
  options: {
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      params: resolveApplicationTask
    }
  },
  handler: async (request, h) => {
    try {
      const { db, params, auth } = request
      const { id, taskId } = params

      const resolvedAt = new Date()
      const resolvedBy = getContactId(auth)

      const result = await db
        .collection(collectionMarineLicences)
        .findOneAndUpdate(
          {
            _id: ObjectId.createFromHexString(id),
            applicationTasks: { $elemMatch: { taskId, resolvedAt: null } }
          },
          buildResolvePipeline(taskId, resolvedAt, resolvedBy)
        )

      // Already resolved, or no such task: a double submit must not break the
      // applicant's journey back to the View details page.
      if (!result) {
        request.logger.info(
          { event: { action: 'resolve-application-task', outcome: 'success' } },
          `Application task ${taskId} on marine licence ${id} was already resolved or does not exist`
        )
      }

      return h
        .response({ message: 'success', value: { taskId } })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(
        `Error when attempting to resolve application task: ${error.message}`
      )
    }
  }
}
