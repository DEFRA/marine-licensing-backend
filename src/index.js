import process from 'node:process'

import {
  createLogger,
  structureErrorForECS
} from './shared/common/helpers/logging/logger.js'
import { startServer } from './shared/common/helpers/start-server.js'

await startServer()

process.on('unhandledRejection', (error) => {
  const logger = createLogger()
  logger.info('Unhandled rejection')
  logger.error(structureErrorForECS(error), 'Unhandled rejection error')
  process.exitCode = 1
})
