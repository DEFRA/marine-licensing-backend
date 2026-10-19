import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { resolveApplicationTask } from '../../models/resolve-application-task.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { getContactId } from '../../../shared/helpers/get-contact-id.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import {
  APPLICATION_TASK_TYPE,
  MARINE_LICENCE_STATUS
} from '../../constants/marine-licence.js'

const markTaskResolved = (taskId, resolvedAt, resolvedBy) => ({
  $set: {
    applicationTasks: {
      $map: {
        input: '$applicationTasks',
        as: 'task',
        in: {
          $cond: [
            { $eq: ['$$task.taskId', taskId] },
            { $mergeObjects: ['$$task', { resolvedAt, resolvedBy }] },
            '$$task'
          ]
        }
      }
    }
  }
})

const isStillActionRequiredWithNoOutstandingTask = {
  $and: [
    { $eq: ['$status', MARINE_LICENCE_STATUS.ACTION_REQUIRED] },
    {
      $allElementsTrue: [
        {
          $map: {
            input: '$applicationTasks',
            as: 'task',
            in: { $ne: [{ $ifNull: ['$$task.resolvedAt', null] }, null] }
          }
        }
      ]
    }
  ]
}

// Checking status as well as the tasks matters: MAS may have transferred or rejected
// the licence while a task was outstanding, and resolving the task must not undo that.
const restoreStatusWhenNoTaskOutstanding = {
  $set: {
    status: {
      $cond: [
        isStillActionRequiredWithNoOutstandingTask,
        {
          $ifNull: ['$previousStatus', MARINE_LICENCE_STATUS.SUBMITTED]
        },
        '$status'
      ]
    },
    previousStatus: {
      $cond: [
        isStillActionRequiredWithNoOutstandingTask,
        '$$REMOVE',
        '$previousStatus'
      ]
    }
  }
}

const isIncompleteResubmission = (task) =>
  task?.type === APPLICATION_TASK_TYPE.RESUBMIT_SITE_NOTICE_EVIDENCE &&
  task.data.locations.some(
    ({ closeUpPhoto, positionPhoto }) => !closeUpPhoto || !positionPhoto
  )

// Photos are only ever added or replaced, never removed, so a resubmission found
// complete here is still complete when the update below runs.
const assertTaskCanBeResolved = async (db, _id, taskId) => {
  const marineLicence = await db
    .collection(collectionMarineLicences)
    .findOne(
      { _id, 'applicationTasks.taskId': taskId },
      { projection: { applicationTasks: { $elemMatch: { taskId } } } }
    )

  if (isIncompleteResubmission(marineLicence?.applicationTasks?.[0])) {
    throw Boom.conflict(
      `Application task ${taskId} still has site notice photos to add`
    )
  }
}

const buildResolvePipeline = (taskId, resolvedAt, resolvedBy) => [
  markTaskResolved(taskId, resolvedAt, resolvedBy),
  restoreStatusWhenNoTaskOutstanding,
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

      const _id = ObjectId.createFromHexString(id)
      const resolvedAt = new Date()
      const resolvedBy = getContactId(auth)

      await assertTaskCanBeResolved(db, _id, taskId)

      const result = await db
        .collection(collectionMarineLicences)
        .findOneAndUpdate(
          {
            _id,
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
