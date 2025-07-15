import { config } from '../../config.js'
import Boom from '@hapi/boom'

export const startExemptionsQueuePolling = (server, intervalMs) => {
  if (!server.app) server.app = {}

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

export const processExemptionsQueue = async (server) => {
  const maxRetries = config.get('dynamics.maxRetries')
  const retryDelayMs = config.get('dynamics.retryDelayMs')

  try {
    server.logger.info('Starting exemption queue poll')

    const now = new Date()

    const queueItems = await server.db
      .collection('exemption-dynamics-queue')
      .find({
        $or: [
          { status: 'pending' },
          {
            status: 'failed',
            retries: { $lt: maxRetries },
            updatedAt: { $lte: new Date(now.getTime() - retryDelayMs) }
          }
        ]
      })
      .toArray()

    server.logger.info(`Found ${queueItems.length} items to process in queue`)

    for (const item of queueItems) {
      try {
        // TODO: Implement actual processing logic here
        server.logger.info(item)
      } catch (err) {
        throw Boom.badImplementation('Processing failed')
      }
    }

    server.logger.info('Exemption queue poll completed')
  } catch (error) {
    throw Boom.badImplementation('Error during processing', error)
  }
}
