import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../../shared/common/helpers/logging/logger.js'
import { MAS_EVENT_ACTION } from '../../../constants/marine-licence.js'

// Generic for every application task type: the caller supplies only the type and its
// opaque `data`. No status is written — "Action required" is derived from any task
// with a null resolvedAt (see shared/helpers/application-tasks.js).
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

  let result

  try {
    result = await db.collection(collectionMarineLicences).findOneAndUpdate(
      {
        applicationReference,
        applicationTasks: {
          $not: { $elemMatch: { type, resolvedAt: null } }
        }
      },
      {
        $push: { applicationTasks: task },
        $set: { updatedAt: now, updatedBy }
      },
      { returnDocument: 'after' }
    )
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
          action: MAS_EVENT_ACTION.JOB_STALE,
          outcome: 'success',
          reference: applicationReference
        }
      },
      `No marine licence found, or an unresolved ${type} task already exists, for applicationReference ${applicationReference}`
    )
    return null
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

  return { marineLicence: result, task }
}
