import Boom from '@hapi/boom'
import {
  REQUEST_QUEUE_STATUS,
  DYNAMICS_QUEUE_TYPES
} from '../../constants/request-queue.js'
import { config } from '../../../../config.js'
import { sendToDynamics } from './dynamics-client.js'
import { structureErrorForECS } from '../../helpers/logging/logger.js'
import {
  collectionDynamicsQueue,
  collectionDynamicsQueueFailed,
  collectionMarineLicenceDynamicsQueue,
  collectionMarineLicenceDynamicsQueueFailed
} from '../../constants/db-collections.js'
import { getDynamicsAccessToken } from './get-access-token.js'

const buildClaimFilter = (now, retryDelayMs, claimStaleMs) => {
  const retryThreshold = new Date(now.getTime() - retryDelayMs)
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

const claimOneQueueItem = async (server, collectionName, filter) => {
  try {
    const result = await server.db.collection(collectionName).findOneAndUpdate(
      filter,
      {
        $set: {
          status: REQUEST_QUEUE_STATUS.IN_PROGRESS,
          updatedAt: new Date()
        }
      },
      { sort: { _id: 1 }, returnDocument: 'after' }
    )
    const doc = result?.value ?? null
    if (!doc) {
      return null
    }
    return { ...doc, _sourceCollection: collectionName }
  } catch (err) {
    server.logger.error(
      structureErrorForECS(err),
      `Failed to claim dynamics queue item from ${collectionName}`
    )
    return null
  }
}

const claimNextQueueItemFair = async (server, filter, preferExemptionFirst) => {
  const order = preferExemptionFirst
    ? [collectionDynamicsQueue, collectionMarineLicenceDynamicsQueue]
    : [collectionMarineLicenceDynamicsQueue, collectionDynamicsQueue]
  for (const collectionName of order) {
    const item = await claimOneQueueItem(server, collectionName, filter)
    if (item) {
      return item
    }
  }
  return null
}

export const startDynamicsQueuePolling = (server, intervalMs) => {
  processDynamicsQueue(server)

  server.app.pollTimer = setInterval(() => {
    processDynamicsQueue(server)
  }, intervalMs)
}

export const stopDynamicsQueuePolling = (server) => {
  if (server?.app?.pollTimer) {
    clearInterval(server.app.pollTimer)
    server.app.pollTimer = null
  }
}

export const handleDynamicsQueueItemSuccess = async (server, item) => {
  await server.db
    .collection(item._sourceCollection)
    .updateOne(
      { _id: item._id },
      { $set: { status: REQUEST_QUEUE_STATUS.SUCCESS, updatedAt: new Date() } }
    )
  server.logger.info(
    `Successfully processed item ${item.applicationReferenceNumber}`
  )
}

export const handleDynamicsQueueItemFailure = async (server, item) => {
  const {
    projects: { maxRetries }
  } = config.get('dynamics')

  const retries = item.retries + 1
  const failedCollection =
    item._sourceCollection === collectionMarineLicenceDynamicsQueue
      ? collectionMarineLicenceDynamicsQueueFailed
      : collectionDynamicsQueueFailed

  if (retries >= maxRetries) {
    const { _sourceCollection, ...itemToStore } = item
    await server.db.collection(failedCollection).insertOne({
      ...itemToStore,
      retries: maxRetries,
      status: REQUEST_QUEUE_STATUS.FAILED,
      updatedAt: new Date()
    })

    await server.db
      .collection(item._sourceCollection)
      .deleteOne({ _id: item._id })

    server.logger.error(
      `Moved item ${item._id} for application ${item.applicationReferenceNumber} to dead letter queue after ${retries} retries`
    )
  } else {
    await server.db.collection(item._sourceCollection).updateOne(
      { _id: item._id },
      {
        $set: { status: REQUEST_QUEUE_STATUS.FAILED, updatedAt: new Date() },
        $inc: { retries: 1 }
      }
    )
    server.logger.error(
      `Incremented retries for item ${item.applicationReferenceNumber} to ${retries}`
    )
  }
}

export const processDynamicsQueue = async (server) => {
  try {
    const now = new Date()
    const {
      projects: { retryDelayMs, claimStaleMs }
    } = config.get('dynamics')

    const filter = buildClaimFilter(now, retryDelayMs, claimStaleMs)

    let preferExemptionFirst = true
    let item = await claimNextQueueItemFair(
      server,
      filter,
      preferExemptionFirst
    )

    if (!item) {
      return
    }

    const accessToken = await getDynamicsAccessToken()

    let processedCount = 0
    while (item) {
      try {
        await sendToDynamics(server, accessToken, item)
        await handleDynamicsQueueItemSuccess(server, item)
      } catch (err) {
        server.logger.error(
          structureErrorForECS(err),
          `Failed to process dynamics queue item ${item.applicationReferenceNumber}`
        )
        await handleDynamicsQueueItemFailure(server, item)
      }
      processedCount++
      preferExemptionFirst = !preferExemptionFirst
      item = await claimNextQueueItemFair(server, filter, preferExemptionFirst)
    }

    if (processedCount > 0) {
      server.logger.info(
        `Processed ${processedCount} item(s) from dynamics queue`
      )
    }
  } catch (error) {
    server.logger.error(
      structureErrorForECS(error),
      'Error during processing dynamics queue'
    )
    throw Boom.badImplementation(
      'Error during processing dynamics queue',
      error.message
    )
  }
}

export const addToDynamicsQueue = async ({
  request,
  applicationReference,
  action,
  type = DYNAMICS_QUEUE_TYPES.EXEMPTION
}) => {
  const { payload, db } = request
  const { createdAt, createdBy, updatedAt, updatedBy } = payload

  const collection =
    type === DYNAMICS_QUEUE_TYPES.MARINE_LICENCE
      ? collectionMarineLicenceDynamicsQueue
      : collectionDynamicsQueue

  await db.collection(collection).insertOne({
    type,
    action,
    applicationReferenceNumber: applicationReference,
    status: REQUEST_QUEUE_STATUS.PENDING,
    retries: 0,
    createdAt,
    createdBy,
    updatedAt,
    updatedBy
  })

  request.server.methods.processDynamicsQueue().catch(() => {
    request.server.logger.error(
      `Failed to process dynamics queue, but ${type} submission succeeded`
    )
  })
}
