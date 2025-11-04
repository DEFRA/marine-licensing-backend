import Boom from '@hapi/boom'
import { REQUEST_QUEUE_STATUS } from '../../constants/request-queue.js'
import { config } from '../../../config.js'
import {
  getDynamicsAccessToken,
  sendExemptionToDynamics
} from './dynamics-client.js'
import {
  collectionDynamicsQueueFailed,
  collectionDynamicsQueue
} from '../../constants/db-collections.js'

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
  await server.db.collection(collectionDynamicsQueue).updateOne(
    { _id: item._id },
    {
      $set: {
        status: REQUEST_QUEUE_STATUS.SUCCESS,
        updatedAt: new Date()
      }
    }
  )
  server.logger.info(
    `Successfully processed item ${item.applicationReferenceNumber}`
  )
}

export const handleDynamicsQueueItemFailure = async (server, item) => {
  const { maxRetries } = config.get('dynamics')

  const retries = item.retries + 1
  if (retries >= maxRetries) {
    await server.db.collection(collectionDynamicsQueueFailed).insertOne({
      ...item,
      retries: maxRetries,
      status: REQUEST_QUEUE_STATUS.FAILED,
      updatedAt: new Date()
    })

    await server.db
      .collection(collectionDynamicsQueue)
      .deleteOne({ _id: item._id })

    server.logger.error(
      `Moved item ${item._id} for application ${item.applicationReferenceNumber} to dead letter queue after ${retries} retries`
    )
  } else {
    await server.db.collection(collectionDynamicsQueue).updateOne(
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
      `Incremented retries for item ${item.applicationReferenceNumber} to ${retries}`
    )
  }
}

export const processDynamicsQueue = async (server) => {
  try {
    const now = new Date()

    const queueItems = await server.db
      .collection(collectionDynamicsQueue)
      .find({
        $or: [
          { status: REQUEST_QUEUE_STATUS.PENDING },
          {
            status: REQUEST_QUEUE_STATUS.FAILED,
            updatedAt: { $lte: new Date(now.getTime() - 0) }
          }
        ]
      })
      .toArray()

    let accessToken

    if (queueItems.length > 0) {
      server.logger.info(`Found ${queueItems.length} items to process in queue`)
      accessToken = await getDynamicsAccessToken()
    }

    for (const item of queueItems) {
      try {
        await sendExemptionToDynamics(server, accessToken, item)
        await handleDynamicsQueueItemSuccess(server, item)
      } catch (err) {
        server.logger.error(err)
        await handleDynamicsQueueItemFailure(server, item)
      }
    }
  } catch (error) {
    server.logger.error(error)
    throw Boom.badImplementation('Error during processing', error.message)
  }
}

export const addToDynamicsQueue = async ({ request, applicationReference }) => {
  const { payload, db } = request
  const { createdAt, createdBy, updatedAt, updatedBy } = payload

  await db.collection(collectionDynamicsQueue).insertOne({
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
      'Failed to process dynamics queue, but exemption submission succeeded'
    )
  })
}
