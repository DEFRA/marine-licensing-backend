import { config } from '../config.js'
import {
  startExemptionsQueuePolling,
  stopExemptionsQueuePolling,
  processExemptionsQueue
} from '../common/helpers/dynamics/index.js'

const fiveMinutesInMS = 5 * 60 * 1000

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
        {
          cache: false,
          generateKey: () => 'process-exemptions-queue'
        }
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
