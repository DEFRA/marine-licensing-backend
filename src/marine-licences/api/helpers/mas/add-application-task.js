import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../../shared/common/helpers/logging/logger.js'
import { MAS_EVENT_ACTION } from '../../../constants/marine-licence.js'

const supersedeUnresolvedTask = (
  db,
  { applicationReference, type, data, updatedBy, now }
) =>
  db.collection(collectionMarineLicences).findOneAndUpdate(
    {
      applicationReference,
      applicationTasks: { $elemMatch: { type, resolvedAt: null } }
    },
    {
      $set: {
        'applicationTasks.$.data': data,
        'applicationTasks.$.receivedAt': now,
        updatedAt: now,
        updatedBy
      }
    },
    { returnDocument: 'after' }
  )

const pushNewTask = (db, { applicationReference, task, updatedBy, now }) =>
  db.collection(collectionMarineLicences).findOneAndUpdate(
    {
      applicationReference,
      applicationTasks: {
        $not: { $elemMatch: { type: task.type, resolvedAt: null } }
      }
    },
    {
      $push: { applicationTasks: task },
      $set: { updatedAt: now, updatedBy }
    },
    { returnDocument: 'after' }
  )

// Generic for every application task type: the caller supplies only the type and its
// opaque `data`. No status is written — "Action required" is derived from any task
// with a null resolvedAt (see shared/helpers/application-tasks.js).
//
// A second message of the same type arriving before the applicant has resolved the
// first carries a decision that supersedes it, so it overwrites the unresolved
// task's data rather than being dropped. Callers can tell the two apart via
// `superseded` and decide whether to notify again.
export const addApplicationTask = async (
  db,
  logger,
  { applicationReference, type, data, updatedBy }
) => {
  const now = new Date()

  const task = {
    taskId: new ObjectId().toHexString(),
    type,
    receivedAt: now,
    resolvedAt: null,
    data
  }

  let superseded
  let result

  try {
    superseded = await supersedeUnresolvedTask(db, {
      applicationReference,
      type,
      data,
      updatedBy,
      now
    })

    result =
      superseded ??
      (await pushNewTask(db, { applicationReference, task, updatedBy, now }))
  } catch (error) {
    logger.error(
      structureErrorForECS(error),
      `Failed to add ${type} application task for applicationReference ${applicationReference}; the queue will retry`
    )
    throw error
  }

  if (!result) {
    logger.warn(
      {
        event: {
          action: MAS_EVENT_ACTION.LICENCE_NOT_FOUND,
          outcome: 'failure',
          reference: applicationReference
        }
      },
      `No marine licence found for applicationReference ${applicationReference}; cannot add ${type} application task`
    )
    return null
  }

  if (superseded) {
    const updatedTask = result.applicationTasks.find(
      (existing) => existing.type === type && existing.resolvedAt == null
    )

    logger.info(
      {
        event: {
          action: MAS_EVENT_ACTION.APPLICATION_TASK_SUPERSEDED,
          outcome: 'success',
          reference: applicationReference
        }
      },
      `Superseded the unresolved ${type} application task for applicationReference ${applicationReference}`
    )

    return { marineLicence: result, task: updatedTask, superseded: true }
  }

  logger.info(
    {
      event: {
        action: MAS_EVENT_ACTION.APPLICATION_TASK_ADDED,
        outcome: 'success',
        reference: applicationReference
      }
    },
    `Added ${type} application task for applicationReference ${applicationReference}`
  )

  return { marineLicence: result, task, superseded: false }
}
