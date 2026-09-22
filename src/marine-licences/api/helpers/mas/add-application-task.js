import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../../shared/common/helpers/logging/logger.js'
import { MAS_EVENT_ACTION } from '../../../constants/marine-licence.js'

// The filter is what enforces "at most one task per type": a concurrent second
// message cannot match it, so the invariant holds without a transaction.
const pushFirstTaskOfType = (
  db,
  { applicationReference, task, updatedBy, now }
) =>
  db.collection(collectionMarineLicences).findOneAndUpdate(
    {
      applicationReference,
      applicationTasks: { $not: { $elemMatch: { type: task.type } } }
    },
    {
      $push: { applicationTasks: task },
      $set: { updatedAt: now, updatedBy }
    },
    { returnDocument: 'after' }
  )

const findLicence = (db, applicationReference) =>
  db
    .collection(collectionMarineLicences)
    .findOne({ applicationReference }, { projection: { applicationTasks: 1 } })

const logLicenceNotFound = (logger, { applicationReference, type }) =>
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

const logRedelivery = (
  logger,
  { applicationReference, type, sourceMessageId }
) =>
  logger.info(
    {
      event: {
        action: MAS_EVENT_ACTION.APPLICATION_TASK_REDELIVERED,
        outcome: 'success',
        reference: applicationReference
      }
    },
    `Message ${sourceMessageId} already created the ${type} application task for applicationReference ${applicationReference}; ignoring redelivery`
  )

const logDuplicate = (logger, { applicationReference, type, existing }) =>
  logger.error(
    {
      event: {
        action: MAS_EVENT_ACTION.APPLICATION_TASK_DUPLICATE,
        outcome: 'failure',
        reference: applicationReference
      }
    },
    `Refused a second ${type} application task for applicationReference ${applicationReference}; MAS sends one per application and task ${existing.taskId} already exists`
  )

// Resolves why the conditional push matched nothing: the licence is missing, the same
// queue message has already been processed, or MAS has broken its one-per-application
// contract. A duplicate leaves the stored task exactly as it is, so an applicant who
// has already read a notification keeps that acknowledgement.
const explainMissedPush = async (
  db,
  logger,
  { applicationReference, type, sourceMessageId }
) => {
  const marineLicence = await findLicence(db, applicationReference)

  if (!marineLicence) {
    logLicenceNotFound(logger, { applicationReference, type })
    return null
  }

  const existing = (marineLicence.applicationTasks ?? []).find(
    (task) => task.type === type
  )

  if (existing?.sourceMessageId === sourceMessageId) {
    logRedelivery(logger, { applicationReference, type, sourceMessageId })
    return null
  }

  logDuplicate(logger, { applicationReference, type, existing })
  return null
}

// Generic for every application task type: the caller supplies only the type and its
// opaque `data`.
//
// MAS sends at most one task of a given type per application, so a second one is a
// broken contract rather than a correction and is refused, not applied.
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
    sourceMessageId: updatedBy,
    data
  }

  let result

  try {
    result = await pushFirstTaskOfType(db, {
      applicationReference,
      task,
      updatedBy,
      now
    })
  } catch (error) {
    logger.error(
      structureErrorForECS(error),
      `Failed to add ${type} application task for applicationReference ${applicationReference}; the queue will retry`
    )
    throw error
  }

  if (!result) {
    return explainMissedPush(db, logger, {
      applicationReference,
      type,
      sourceMessageId: updatedBy
    })
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
