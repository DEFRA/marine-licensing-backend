import Boom from '@hapi/boom'
import { REQUEST_QUEUE_STATUS } from '../../constants/request-queue.js'
import { config } from '../../../config.js'
import { getDynamicsAccessToken } from './dynamics-client.js'

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
  await server.db.collection('exemption-dynamics-queue').updateOne(
    { _id: item._id },
    {
      $set: {
        status: REQUEST_QUEUE_STATUS.SUCCESS,
        updatedAt: new Date()
      }
    }
  )
  server.logger.info(`Successfully processed item ${item._id}`)
}

export const handleQueueItemFailure = async (server, item) => {
  const { maxRetries } = config.get('dynamics')

  const retries = item.retries + 1
  if (retries >= maxRetries) {
    await server.db.collection('exemption-dynamics-queue-failed').insertOne({
      ...item,
      retries: maxRetries,
      status: REQUEST_QUEUE_STATUS.FAILED
    })

    await server.db
      .collection('exemption-dynamics-queue')
      .deleteOne({ _id: item._id })

    server.logger.error(
      `Moved item ${item._id} to dead letter queue after ${retries} retries`
    )
  } else {
    await server.db.collection('exemption-dynamics-queue').updateOne(
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
      `Incremented retries for item ${item._id} to ${retries}`
    )
  }
}

export const processExemptionsQueue = async (server) => {
  try {
    server.logger.info('Starting exemption queue poll')

    const now = new Date()

    const queueItems = await server.db
      .collection('exemption-dynamics-queue')
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

    server.logger.info(`Found ${queueItems.length} items to process in queue`)

    if (queueItems.length > 0) {
      await getDynamicsAccessToken(server)
    }

    for (const item of queueItems) {
      try {
        await handleQueueItemSuccess(server, item)
      } catch (err) {
        await handleQueueItemFailure(server, item)
      }
    }
  } catch (error) {
    throw Boom.badImplementation('Error during processing')
  }
}
