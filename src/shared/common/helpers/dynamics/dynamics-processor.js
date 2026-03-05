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

const fetchQueueItems = async (server, collectionName, query) => {
  try {
    const items = await server.db
      .collection(collectionName)
      .find(query)
      .toArray()
    return items.map((i) => ({ ...i, _sourceCollection: collectionName }))
  } catch (err) {
    server.logger.error(
      structureErrorForECS(err),
      `Failed to fetch dynamics queue items from ${collectionName}`
    )
    return []
  }
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
    exemptions: { maxRetries }
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

    const query = {
      $or: [
        { status: REQUEST_QUEUE_STATUS.PENDING },
        {
          status: REQUEST_QUEUE_STATUS.FAILED,
          updatedAt: { $lte: new Date(now.getTime() - 0) }
        }
      ]
    }

    const [exemptionItems, marineLicenceItems] = await Promise.all([
      fetchQueueItems(server, collectionDynamicsQueue, query),
      fetchQueueItems(server, collectionMarineLicenceDynamicsQueue, query)
    ])

    const queueItems = [...exemptionItems, ...marineLicenceItems]

    if (queueItems.length === 0) {
      return
    }

    server.logger.info(
      `Found ${queueItems.length} items to process in dynamics queue`
    )

    const accessToken = await getDynamicsAccessToken()

    for (const item of queueItems) {
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
