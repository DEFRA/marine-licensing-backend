import {
  startExemptionsQueuePolling,
  stopExemptionsQueuePolling
} from '../common/helpers/dynamics.js'

const fiveMinutesInMS = 5 * 60 * 1000

const processExemptionsQueuePlugin = {
  plugin: {
    name: 'process-exemptions-queue',
    register: async (server, options = {}) => {
      const pollInterval = options.pollIntervalMs || fiveMinutesInMS

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
