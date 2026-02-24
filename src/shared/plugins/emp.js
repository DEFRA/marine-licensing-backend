import { config } from '../../config.js'
import {
  startEmpQueuePolling,
  stopEmpQueuePolling,
  processEmpQueue
} from '../common/helpers/emp/index.js'

const fiveMinutesInMS = 300_000

const processEmpQueuePlugin = {
  plugin: {
    name: 'process-emp-queue',
    register: async (server, options = {}) => {
      const { isEmpEnabled } = config.get('exploreMarinePlanning')

      if (!isEmpEnabled) {
        return
      }

      const { pollIntervalMs } = options

      const pollInterval = pollIntervalMs || fiveMinutesInMS

      server.method(
        'processEmpQueue',
        async () => {
          return processEmpQueue(server)
        },
        {}
      )

      server.ext('onPostStart', () => {
        startEmpQueuePolling(server, pollInterval)
      })

      server.ext('onPreStop', () => {
        stopEmpQueuePolling(server)
      })

      server.logger.info('processEmpQueue plugin registered')
    }
  }
}

export { processEmpQueuePlugin }
