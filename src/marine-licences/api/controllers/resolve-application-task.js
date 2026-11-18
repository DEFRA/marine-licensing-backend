import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { resolveApplicationTask } from '../../models/resolve-application-task.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { getContactId } from '../../../shared/helpers/get-contact-id.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import {
  APPLICATION_TASK_TYPE,
  MARINE_LICENCE_DYNAMICS_EVENT_ACTION,
  MARINE_LICENCE_STATUS
} from '../../constants/marine-licence.js'
import { config } from '../../../config.js'
import { addToDynamicsQueue } from '../../../shared/common/helpers/dynamics/index.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'
import {
  DYNAMICS_QUEUE_TYPES,
  DYNAMICS_REQUEST_ACTIONS
} from '../../../shared/common/constants/request-queue.js'
import { buildSiteNoticeEvidenceDynamicsPayload } from '../helpers/format-site-notice-evidence-for-gateway.js'
import {
  markFailedToSendToDynamics,
  outboundKey
} from '../helpers/dynamics/worker-processor.js'

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

const isNotIncompleteResubmission = {
  $or: [
    { type: { $ne: APPLICATION_TASK_TYPE.RESUBMIT_SITE_NOTICE_EVIDENCE } },
    {
      'data.locations': {
        $not: {
          $elemMatch: { $or: [{ closeUpPhoto: null }, { positionPhoto: null }] }
        }
      }
    }
  ]
}

// The filter only refuses an outstanding task when it is a resubmission still missing
// a photo, so a task found outstanding after a miss is one of those.
const explainMissedResolve = async (request, _id, taskId) => {
  const marineLicence = await request.db
    .collection(collectionMarineLicences)
    .findOne(
      { _id, 'applicationTasks.taskId': taskId },
      { projection: { applicationTasks: { $elemMatch: { taskId } } } }
    )
  const task = marineLicence?.applicationTasks?.[0]

  if (task && !task.resolvedAt) {
    throw Boom.conflict(
      `Application task ${taskId} still has site notice photos to add`
    )
  }

  // Already resolved, or no such task: a double submit must not break the
  // applicant's journey back to the View details page.
  request.logger.info(
    { event: { action: 'resolve-application-task', outcome: 'success' } },
    `Application task ${taskId} on marine licence ${_id} was already resolved or does not exist`
  )
}

const buildResolvePipeline = (taskId, resolvedAt, resolvedBy) => [
  markTaskResolved(taskId, resolvedAt, resolvedBy),
  restoreStatusWhenNoTaskOutstanding,
  { $set: { updatedAt: resolvedAt, updatedBy: resolvedBy } }
]

const isPublicSiteNoticeTask = (marineLicence, taskId) =>
  (marineLicence.applicationTasks ?? []).some(
    (task) =>
      task.taskId === taskId &&
      task.type === APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE
  )

const queueSiteNoticeEvidenceForDynamics = async (
  request,
  { applicationReference, marineLicenceId, siteNoticeEvidence }
) => {
  const action = DYNAMICS_REQUEST_ACTIONS.SEND_SITE_NOTICE_EVIDENCE
  const { locationCount, locations } = buildSiteNoticeEvidenceDynamicsPayload(
    siteNoticeEvidence,
    config.get('backendGatewayUrl'),
    marineLicenceId
  )

  try {
    await addToDynamicsQueue({
      request,
      applicationReference,
      action,
      type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE,
      locationCount,
      locations
    })
  } catch (error) {
    request.logger.error(
      {
        ...structureErrorForECS(error),
        event: {
          action: MARINE_LICENCE_DYNAMICS_EVENT_ACTION.MARKED_FAILED,
          outcome: 'failure',
          reference: applicationReference,
          reason: 'Enqueue failed; no automatic retry'
        }
      },
      `Failed to queue site notice evidence for ${applicationReference} to Dynamics; marked failed`
    )
    await markFailedToSendToDynamics(
      request.db,
      applicationReference,
      outboundKey({ action })
    )
  }
}

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

      const result = await db
        .collection(collectionMarineLicences)
        .findOneAndUpdate(
          {
            _id,
            applicationTasks: {
              $elemMatch: {
                taskId,
                resolvedAt: null,
                ...isNotIncompleteResubmission
              }
            }
          },
          buildResolvePipeline(taskId, resolvedAt, resolvedBy)
        )

      if (!result) {
        await explainMissedResolve(request, _id, taskId)
      } else {
        if (
          isPublicSiteNoticeTask(result, taskId) &&
          config.get('dynamics').isDynamicsEnabled
        ) {
          await queueSiteNoticeEvidenceForDynamics(request, {
            applicationReference: result.applicationReference,
            marineLicenceId: id,
            siteNoticeEvidence: result.siteNoticeEvidence
          })
        }
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
