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

// Reads the array the previous stage produced, so the last task to be resolved is the
// one that reveals previousStatus again. A licence withdrawn while the task was
// outstanding has no previousStatus, and $ifNull leaves its status alone.
const restoreStatusWhenNothingOutstanding = {
  $set: {
    status: {
      $cond: [
        { $gt: [{ $size: { $ifNull: ['$outstandingTasks', []] } }, 0] },
        '$status',
        { $ifNull: ['$previousStatus', '$status'] }
      ]
    },
    previousStatus: {
      $cond: [
        { $gt: [{ $size: { $ifNull: ['$outstandingTasks', []] } }, 0] },
        '$previousStatus',
        '$$REMOVE'
      ]
    }
  }
}

const buildResolvePipeline = (taskId, resolvedAt, resolvedBy) => [
  markTaskResolved(taskId, resolvedAt),
  {
    $set: {
      outstandingTasks: {
        $filter: {
          input: '$applicationTasks',
          cond: { $eq: ['$$this.resolvedAt', null] }
        }
      }
    }
  },
  restoreStatusWhenNothingOutstanding,
  { $set: { updatedAt: resolvedAt, updatedBy: resolvedBy } },
  { $unset: 'outstandingTasks' }
]

// Generic across application task types: resolving the last outstanding task puts the
// application back to the status ACTION_REQUIRED masked, in the same write.
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
