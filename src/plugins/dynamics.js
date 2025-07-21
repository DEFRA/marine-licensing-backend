import { config } from '../config.js'
import {
  startExemptionsQueuePolling,
  stopExemptionsQueuePolling,
  processExemptionsQueue
} from '../common/helpers/dynamics/index.js'

const fiveMinutesInMS = 300000

const processExemptionsQueuePlugin = {
  plugin: {
    name: 'process-exemptions-queue',
    register: async (server, options = {}) => {
      const { isEnabled } = config.get('dynamics')

      if (!isEnabled) {
        return
      }

      const { pollIntervalMs } = options

      const pollInterval = pollIntervalMs || fiveMinutesInMS

      server.method(
        'processExemptionsQueue',
        async () => {
          return await processExemptionsQueue(server)
        },
        {}
      )

      server.ext('onPostStart', () => {
        startExemptionsQueuePolling(server, pollInterval)
      })

      server.ext('onPreStop', () => {
        stopExemptionsQueuePolling(server)
      })

      server.logger.info('processExemptionsQueue plugin registered')
    }
  }
}

export { processExemptionsQueuePlugin }
