import Boom from '@hapi/boom'
import { REQUEST_QUEUE_STATUS } from '../../constants/request-queue.js'
import { config } from '../../../config.js'
import { sendExemptionToEmp } from './emp-client.js'
import { structureErrorForECS } from '../../helpers/logging/logger.js'

import {
  collectionEmpQueue,
  collectionEmpQueueFailed
} from '../../constants/db-collections.js'

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

export const handleEmpQueueItemSuccess = async (server, item) => {
  await server.db.collection(collectionEmpQueue).updateOne(
    { _id: item._id },
    {
      $set: {
        status: REQUEST_QUEUE_STATUS.SUCCESS,
        updatedAt: new Date(),
        whoExemptionIsFor: null
      }
    }
  )
  server.logger.info(
    `Successfully processed item ${item.applicationReferenceNumber}`
  )
}

export const handleEmpQueueItemFailure = async (server, item) => {
  const { maxRetries } = config.get('exploreMarinePlanning')

  const retries = item.retries + 1
  if (retries >= maxRetries) {
    await server.db.collection(collectionEmpQueueFailed).insertOne({
      ...item,
      retries: maxRetries,
      status: REQUEST_QUEUE_STATUS.FAILED,
      updatedAt: new Date(),
      whoExemptionIsFor: null
    })

    await server.db.collection(collectionEmpQueue).deleteOne({ _id: item._id })

    server.logger.error(
      `Moved EMP queue item ${item._id} for application ${item.applicationReferenceNumber} to failure queue after ${retries} retries`
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
      `Incremented retries for EMP queue item ${item.applicationReferenceNumber} to ${retries}`
    )
  }
}

export const processEmpQueue = async (server) => {
  try {
    const now = new Date()

    const queueItems = await server.db
      .collection(collectionEmpQueue)
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

    if (queueItems.length > 0) {
      server.logger.info(
        `Found ${queueItems.length} items to process in EMP queue`
      )
    }

    for (const item of queueItems) {
      try {
        await sendExemptionToEmp(server, item)
        await handleEmpQueueItemSuccess(server, item)
      } catch (err) {
        server.logger.error(
          structureErrorForECS(err),
          `Failed to process EMP queue item ${item.applicationReferenceNumber}`
        )
        await handleEmpQueueItemFailure(server, item)
      }
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

export const addToEmpQueue = async ({ db, fields, server }) => {
  const {
    applicationReference,
    createdAt,
    createdBy,
    updatedAt,
    updatedBy,
    whoExemptionIsFor
  } = fields

  await db.collection(collectionEmpQueue).insertOne({
    applicationReferenceNumber: applicationReference,
    status: REQUEST_QUEUE_STATUS.PENDING,
    retries: 0,
    createdAt,
    createdBy,
    updatedAt,
    updatedBy,
    whoExemptionIsFor
  })

  server.methods.processEmpQueue().catch(() => {
    server.logger.error(
      'Failed to process EMP queue, but exemption submission succeeded'
    )
  })
}
