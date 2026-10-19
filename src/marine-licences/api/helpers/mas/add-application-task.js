import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../../shared/common/helpers/logging/logger.js'
import {
  APPLICATION_TASK_TYPE,
  MARINE_LICENCE_STATUS,
  MARINE_LICENCE_SUBMITTED_STATUSES,
  MAS_EVENT_ACTION,
  REPEATABLE_APPLICATION_TASK_TYPES
} from '../../../constants/marine-licence.js'

const isRepeatable = (type) => REPEATABLE_APPLICATION_TASK_TYPES.includes(type)

// A repeatable type matching on sourceMessageId as well is what keeps a redelivered
// message from adding a second task once the applicant has resolved the first.
const noBlockingTaskOfType = (type, sourceMessageId) =>
  isRepeatable(type)
    ? {
        applicationTasks: { $not: { $elemMatch: { type, resolvedAt: null } } },
        'applicationTasks.sourceMessageId': { $ne: sourceMessageId }
      }
    : { applicationTasks: { $not: { $elemMatch: { type } } } }

// The filter is what enforces "at most one task per type" (one outstanding task, for a
// repeatable type): a concurrent second message cannot match it, so the invariant
// holds without a transaction.
//
// Only a submitted application moves to ACTION_REQUIRED: one withdrawn, rejected or
// transferred before the task arrived keeps its status, or it would become withdrawable
// again. previousStatus is what resolving the last outstanding task
// restores, so a second task arriving while already ACTION_REQUIRED must not overwrite
// it. The task is wrapped in $literal because it carries caseworker free text, and in a
// pipeline a string starting with "$" would otherwise be read as a field path.
const pushFirstTaskOfType = (
  db,
  { applicationReference, task, updatedBy, now }
) => {
  const update = {
    applicationTasks: {
      $concatArrays: [
        { $ifNull: ['$applicationTasks', []] },
        { $literal: [task] }
      ]
    },
    previousStatus: {
      $cond: [
        { $eq: ['$status', MARINE_LICENCE_STATUS.SUBMITTED] },
        '$status',
        '$previousStatus'
      ]
    },
    status: {
      $cond: [
        { $in: ['$status', MARINE_LICENCE_SUBMITTED_STATUSES] },
        MARINE_LICENCE_STATUS.ACTION_REQUIRED,
        '$status'
      ]
    },
    updatedAt: now,
    updatedBy
  }

  if (task.type === APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE) {
    update.siteNoticeEvidence = {
      $concatArrays: [
        { $ifNull: ['$siteNoticeEvidence', []] },
        { $literal: [{}] }
      ]
    }
  }

  return db.collection(collectionMarineLicences).findOneAndUpdate(
    {
      applicationReference,
      ...noBlockingTaskOfType(task.type, task.sourceMessageId)
    },
    [{ $set: update }],
    { returnDocument: 'after' }
  )
}

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
    isRepeatable(type)
      ? `Refused a second ${type} application task for applicationReference ${applicationReference}; task ${existing.taskId} is still outstanding`
      : `Refused a second ${type} application task for applicationReference ${applicationReference}; MAS sends one per application and task ${existing.taskId} already exists`
  )

// Resolves why the conditional push matched nothing: the licence is missing, the same
// queue message has already been processed, or MAS has broken its one-per-application
// (one-outstanding, for a repeatable type) contract. A duplicate leaves the stored task exactly as it is, so an applicant who
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

  const tasks = marineLicence.applicationTasks ?? []

  if (tasks.some((task) => task.sourceMessageId === sourceMessageId)) {
    logRedelivery(logger, { applicationReference, type, sourceMessageId })
    return null
  }

  const existing = tasks.find(
    (task) => task.type === type && !(isRepeatable(type) && task.resolvedAt)
  )

  logDuplicate(logger, { applicationReference, type, existing })
  return null
}

// Generic for every application task type: the caller supplies only the type and its
// opaque `data`.
//
// MAS sends at most one task of a given type per application (or, for a repeatable
// type, one at a time), so a second one is a broken contract rather than a correction
// and is refused, not applied.
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
