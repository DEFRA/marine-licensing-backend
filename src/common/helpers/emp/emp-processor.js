import Boom from '@hapi/boom'
import {
  REQUEST_QUEUE_STATUS,
  EMP_REQUEST_ACTIONS
} from '../../constants/request-queue.js'
import { config } from '../../../config.js'
import { sendExemptionToEmp, withdrawExemptionFromEmp } from './emp-client.js'
import { structureErrorForECS } from '../logging/logger.js'

import {
  collectionEmpQueue,
  collectionEmpQueueFailed
} from '../../constants/db-collections.js'

const QUEUE_DELAY_MS = 2_000

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

export const handleEmpQueueItemSuccess = async (server, item, empFeatureId) => {
  await server.db.collection(collectionEmpQueue).updateOne(
    { _id: item._id },
    {
      $set: {
        status: REQUEST_QUEUE_STATUS.SUCCESS,
        updatedAt: new Date(),
        empFeatureId
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

const processEmpQueueItem = async (server, item) => {
  try {
    const result =
      item.action === EMP_REQUEST_ACTIONS.WITHDRAW
        ? await withdrawExemptionFromEmp(server, item)
        : await sendExemptionToEmp(server, item)
    await handleEmpQueueItemSuccess(server, item, result.objectId)
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

    const queueItems = await server.db
      .collection(collectionEmpQueue)
      .find({
        $or: [
          { status: REQUEST_QUEUE_STATUS.PENDING },
          {
            status: REQUEST_QUEUE_STATUS.FAILED,
            updatedAt: { $lte: new Date(now.getTime() - QUEUE_DELAY_MS) }
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
      await processEmpQueueItem(server, item)
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

  await db.collection(collectionEmpQueue).insertOne({
    action,
    applicationReferenceNumber: applicationReference,
    status: REQUEST_QUEUE_STATUS.PENDING,
    retries: 0,
    createdAt,
    createdBy,
    updatedAt,
    updatedBy
  })

  request.server.methods.processEmpQueue().catch(() => {
    request.server.logger.error(
      'Failed to process EMP queue, but exemption submission succeeded'
    )
  })
}
