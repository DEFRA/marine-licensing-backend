import Boom from '@hapi/boom'
import {
  REQUEST_QUEUE_STATUS,
  EMP_REQUEST_ACTIONS
} from '../../constants/request-queue.js'
import { config } from '../../../../config.js'
import {
  sendExemptionToEmp,
  withdrawExemptionFromEmp,
  updateExemptionStatusInEmp
} from './emp-client.js'
import { structureErrorForECS } from '../logging/logger.js'
import { buildEmpQueueItem } from './emp-queue.js'

import {
  collectionEmpQueue,
  collectionEmpQueueFailed
} from '../../constants/db-collections.js'

const QUEUE_DELAY_MS = 2_000

/** Bounds work per `processEmpQueue` run when the queue is large (avoids overlap with the polling interval). */
export const EMP_QUEUE_MAX_ITEMS_PER_PROCESS_RUN = 50

const buildClaimFilter = (now, claimStaleMs) => {
  const retryThreshold = new Date(now.getTime() - QUEUE_DELAY_MS)
  const staleClaimThreshold = new Date(now.getTime() - claimStaleMs)
  return {
    $or: [
      { status: REQUEST_QUEUE_STATUS.PENDING },
      {
        status: REQUEST_QUEUE_STATUS.FAILED,
        updatedAt: { $lte: retryThreshold }
      },
      {
        status: REQUEST_QUEUE_STATUS.IN_PROGRESS,
        updatedAt: { $lte: staleClaimThreshold }
      }
    ]
  }
}

const claimOneQueueItem = async (server, filter) => {
  try {
    const result = await server.db
      .collection(collectionEmpQueue)
      .findOneAndUpdate(
        filter,
        {
          $set: {
            status: REQUEST_QUEUE_STATUS.IN_PROGRESS,
            updatedAt: new Date()
          }
        },
        {
          sort: { _id: 1 },
          returnDocument: 'after',
          // includeResultMetadata: true returns the raw reply; the document is
          // read from .value, which yields null when nothing matched.
          includeResultMetadata: true
        }
      )
    return result?.value ?? null
  } catch (err) {
    server.logger.error(
      structureErrorForECS(err),
      'Failed to claim EMP queue item'
    )
    return null
  }
}

export const startEmpQueuePolling = (server, intervalMs) => {
  processEmpQueue(server)

  server.app.pollTimer = setInterval(() => {
    processEmpQueue(server)
  }, intervalMs)
}

export const stopEmpQueuePolling = (server) => {
  if (server?.app?.pollTimer) {
    clearInterval(server.app.pollTimer)
    server.app.pollTimer = null
  }
}

export const handleEmpQueueItemSuccess = async (
  server,
  item,
  empFeatureIds
) => {
  await server.db.collection(collectionEmpQueue).updateOne(
    { _id: item._id },
    {
      $set: {
        status: REQUEST_QUEUE_STATUS.SUCCESS,
        updatedAt: new Date(),
        empFeatureIds
      }
    }
  )
  server.logger.info(
    `Successfully processed EMP queue item ${item._id} for application ${item.applicationReferenceNumber}`
  )
}

export const handleEmpQueueItemFailure = async (
  server,
  item,
  { hardFail = false } = {}
) => {
  const { maxRetries } = config.get('exploreMarinePlanning')

  const retries = item.retries + 1
  if (hardFail || retries >= maxRetries) {
    await server.db.collection(collectionEmpQueueFailed).insertOne({
      ...item,
      retries: hardFail ? item.retries : maxRetries,
      status: REQUEST_QUEUE_STATUS.FAILED,
      updatedAt: new Date()
    })

    await server.db.collection(collectionEmpQueue).deleteOne({ _id: item._id })

    const failureReason = hardFail ? '(hard fail)' : `after ${retries} retries`
    server.logger.error(
      `Moved EMP queue item ${item._id} for application ${item.applicationReferenceNumber} to failure queue ${failureReason}`
    )
  } else {
    await server.db.collection(collectionEmpQueue).updateOne(
      { _id: item._id },
      {
        $set: {
          status: REQUEST_QUEUE_STATUS.FAILED,
          updatedAt: new Date()
        },
        $inc: { retries: 1 }
      }
    )
    server.logger.error(
      `Incremented retries for EMP queue item ${item._id} for application ${item.applicationReferenceNumber} to ${retries}`
    )
  }
}

// An unrecognised or absent action is an add, which is what rows written
// before the action field existed rely on.
const EMP_ACTION_HANDLERS = {
  [EMP_REQUEST_ACTIONS.WITHDRAW]: withdrawExemptionFromEmp,
  [EMP_REQUEST_ACTIONS.UPDATE_STATUS]: updateExemptionStatusInEmp
}

const processEmpQueueItem = async (server, item) => {
  try {
    const push = EMP_ACTION_HANDLERS[item.action] ?? sendExemptionToEmp
    const result = await push(server, item)
    await handleEmpQueueItemSuccess(server, item, result.objectIds)
  } catch (err) {
    server.logger.error(
      structureErrorForECS(err),
      `Failed to process EMP queue item ${item._id} for application ${item.applicationReferenceNumber}`
    )
    const hardFail = err.message?.includes('no objectId found')
    await handleEmpQueueItemFailure(server, item, { hardFail })
  }
}

export const processEmpQueue = async (server) => {
  try {
    const now = new Date()
    const { claimStaleMs } = config.get('exploreMarinePlanning')
    const filter = buildClaimFilter(now, claimStaleMs)

    let item = await claimOneQueueItem(server, filter)
    let processedCount = 0

    while (item) {
      await processEmpQueueItem(server, item)
      processedCount++
      if (processedCount >= EMP_QUEUE_MAX_ITEMS_PER_PROCESS_RUN) {
        break
      }
      item = await claimOneQueueItem(server, filter)
    }

    if (processedCount > 0) {
      server.logger.info(`Processed ${processedCount} item(s) from EMP queue`)
    }
  } catch (error) {
    server.logger.error(
      structureErrorForECS(error),
      'Error during processing EMP queue'
    )
    throw Boom.badImplementation(
      'Error during processing EMP queue',
      error.message
    )
  }
}

export const addToEmpQueue = async ({
  request,
  applicationReference,
  action = EMP_REQUEST_ACTIONS.ADD
}) => {
  const { payload, db } = request
  const { createdAt, createdBy, updatedAt, updatedBy } = payload

  await db.collection(collectionEmpQueue).insertOne(
    buildEmpQueueItem({
      applicationReference,
      action,
      createdAt,
      createdBy,
      updatedAt,
      updatedBy
    })
  )

  request.server.methods.processEmpQueue().catch(() => {
    request.server.logger.error(
      'Failed to process EMP queue, but exemption submission succeeded'
    )
  })
}
