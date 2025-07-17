import { config } from '../config.js'
import {
  startExemptionsQueuePolling,
  stopExemptionsQueuePolling
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
