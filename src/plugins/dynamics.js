import { config } from '../config.js'
import {
  startDynamicsQueuePolling,
  stopDynamicsQueuePolling,
  processDynamicsQueue
} from '../common/helpers/dynamics/index.js'

const fiveMinutesInMS = 300_000

const processDynamicsQueuePlugin = {
  plugin: {
    name: 'process-dynamics-queue',
    register: async (server, options = {}) => {
      const { isDynamicsEnabled } = config.get('dynamics')

      if (!isDynamicsEnabled) {
        return
      }

      const { pollIntervalMs } = options

      const pollInterval = pollIntervalMs || fiveMinutesInMS

      server.method(
        'processDynamicsQueue',
        async () => {
          return processDynamicsQueue(server)
        },
        {}
      )

      server.ext('onPostStart', () => {
        startDynamicsQueuePolling(server, pollInterval)
      })

      server.ext('onPreStop', () => {
        stopDynamicsQueuePolling(server)
      })

      server.logger.info('processDynamicsQueue plugin registered')
    }
  }
}

export { processDynamicsQueuePlugin }
