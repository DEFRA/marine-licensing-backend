import Boom from '@hapi/boom'
import { REQUEST_QUEUE_STATUS } from '../../constants/request-queue.js'
import { config } from '../../../config.js'
import {
  getDynamicsAccessToken,
  sendExemptionToDynamics
} from './dynamics-client.js'

const DYNAMICS_QUEUE_TABLE = 'exemption-dynamics-queue'

export const startExemptionsQueuePolling = (server, intervalMs) => {
  processExemptionsQueue(server)

  server.app.pollTimer = setInterval(() => {
    processExemptionsQueue(server)
  }, intervalMs)
}

export const stopExemptionsQueuePolling = (server) => {
  if (server?.app?.pollTimer) {
    clearInterval(server.app.pollTimer)
    server.app.pollTimer = null
  }
}

export const handleQueueItemSuccess = async (server, item) => {
  await server.db.collection(DYNAMICS_QUEUE_TABLE).updateOne(
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

export const handleQueueItemFailure = async (server, item) => {
  const { maxRetries } = config.get('dynamics')

  const retries = item.retries + 1
  if (retries >= maxRetries) {
    await server.db.collection('exemption-dynamics-queue-failed').insertOne({
      ...item,
      retries: maxRetries,
      status: REQUEST_QUEUE_STATUS.FAILED,
      updatedAt: new Date()
    })

    await server.db
      .collection(DYNAMICS_QUEUE_TABLE)
      .deleteOne({ _id: item._id })

    server.logger.error(
      `Moved item ${item._id} for application ${item.applicationReferenceNumber} to dead letter queue after ${retries} retries`
    )
  } else {
    await server.db.collection(DYNAMICS_QUEUE_TABLE).updateOne(
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

export const processExemptionsQueue = async (server) => {
  try {
    const now = new Date()

    const queueItems = await server.db
      .collection(DYNAMICS_QUEUE_TABLE)
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
        await handleQueueItemSuccess(server, item)
      } catch (err) {
        server.logger.error(err)
        await handleQueueItemFailure(server, item)
      }
    }
  } catch (error) {
    server.logger.error(error)
    throw Boom.badImplementation('Error during processing', error.message)
  }
}
