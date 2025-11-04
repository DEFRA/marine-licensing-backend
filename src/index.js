import process from 'node:process'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

import { createLogger } from './common/helpers/logging/logger.js'
import { startServer } from './common/helpers/start-server.js'

const execAsync = promisify(exec)

/**
 * Run database cleanup on startup
 * This version ALWAYS runs cleanup - use for pre-production deployment only
 */
async function runStartupCleanup() {
  const logger = createLogger()
  logger.info(
    '🧹 Running database cleanup on startup (this will delete all data)'
  )

  try {
    const { stdout, stderr } = await execAsync(
      'node scripts/cleanup-database-non-interactive.js'
    )

    if (stdout) {
      logger.info('Cleanup output:', stdout)
    }

    if (stderr) {
      logger.warn('Cleanup stderr:', stderr)
    }

    logger.info('✅ Database cleanup completed successfully')
  } catch (error) {
    logger.error('❌ Database cleanup failed:', error)
    throw error
  }
}

// ALWAYS run cleanup on startup, then start the server
await runStartupCleanup()
await startServer()

process.on('unhandledRejection', (error) => {
  const logger = createLogger()
  logger.info('Unhandled rejection')
  logger.error(error)
  process.exitCode = 1
})
