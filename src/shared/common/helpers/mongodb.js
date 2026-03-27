import { MongoClient } from 'mongodb'
import { LockManager } from 'mongo-locks'
import { up, status } from 'migrate-mongo'

import { addCreateAuditFields, addUpdateAuditFields } from './mongo-audit.js'

export const addAuditFields = (request, h) => {
  const requestMethod = request.method.toUpperCase()

  if (requestMethod === 'GET' || requestMethod === 'DELETE') {
    return h.continue
  }

  const isUnauthenticatedRequest = !request.auth?.credentials

  if (isUnauthenticatedRequest) {
    return h.continue
  }

  const { auth, payload } = request

  if (requestMethod === 'POST') {
    request.payload = addCreateAuditFields(auth, payload)
    return h.continue
  }

  request.payload = addUpdateAuditFields(auth, payload)

  return h.continue
}

export const mongoDb = {
  plugin: {
    name: 'mongodb',
    version: '1.0.0',
    register: async function (server, options) {
      server.logger.info('Setting up MongoDb')

      const client = await MongoClient.connect(options.mongoUrl, {
        ...options.mongoOptions
      })

      const databaseName = options.databaseName
      const db = client.db(databaseName)
      const locker = new LockManager(db.collection('mongo-locks'))

      const lockTtlSeconds = options.migrationLockTtl

      // Ensure the mongo-locks unique index exists before we attempt to acquire a lock.
      // LockManager creates it in its constructor but does not await it.
      await db
        .collection('mongo-locks')
        .createIndex({ action: 1 }, { unique: true })

      await logMigrationStatus(server.logger, db)
      await runMigrationsWithLock(
        server.logger,
        db,
        client,
        locker,
        lockTtlSeconds
      )

      server.logger.info(`MongoDb connected to ${databaseName}`)

      server.decorate('server', 'mongoClient', client)
      server.decorate('server', 'db', db)
      server.decorate('server', 'locker', locker)
      server.decorate('request', 'db', () => db, { apply: true })
      server.decorate('request', 'locker', () => locker, { apply: true })

      server.ext('onPreHandler', addAuditFields)

      server.events.on('stop', async () => {
        server.logger.info('Closing Mongo client')
        await client.close(true)
      })
    }
  }
}

export async function logMigrationStatus(logger, db) {
  try {
    const migrationStatus = await status(db)
    logger.info(migrationStatus, 'Migration status')
  } catch (error) {
    logger.error(error, 'Failed to get migration status')
    throw error
  }
}

const MIGRATION_LOCK_KEY = 'migration-lock'
const MIGRATION_LOCK_RETRY_INTERVAL_MS = 5_000

export async function runMigrationsWithLock(
  logger,
  db,
  client,
  locker,
  lockTtlSeconds
) {
  let lock = await locker.lock(MIGRATION_LOCK_KEY)

  while (!lock) {
    logger.info('Another instance is running migrations, waiting for lock...')
    await new Promise((resolve) =>
      setTimeout(resolve, MIGRATION_LOCK_RETRY_INTERVAL_MS)
    )
    lock = await locker.lock(MIGRATION_LOCK_KEY)
  }

  try {
    await runMigrations(logger, db, client, lockTtlSeconds)
  } finally {
    await lock.free()
  }
}

// Log at WARNING once migrations take 80% or more of the migration locktime TTL.
const TTL_LOCK_WARNING_THRESHOLD = 0.8

export async function runMigrations(logger, db, client, lockTtlSeconds) {
  try {
    logger.info('Applying migrations...')
    const startTime = performance.now()
    const migrated = await up(db, client)
    const durationMs = performance.now() - startTime
    const durationSeconds = Number.parseFloat(
      Math.round(durationMs / 1000).toFixed(2)
    )

    if (migrated.length) {
      logger.info(
        { migrated, durationSeconds },
        'Migrations applied successfully'
      )
    } else {
      logger.info('No pending migrations')
    }

    const warningThreshold = lockTtlSeconds * TTL_LOCK_WARNING_THRESHOLD
    if (migrated.length && durationSeconds >= lockTtlSeconds) {
      logger.fatal(
        { durationSeconds, lockTtlSeconds },
        'THE MIGRATIONS COMPLETED BUT EXCEEDED THE LOCK TTL — OTHER INSTANCES MAY HAVE RUN MIGRATIONS CONCURRENTLY'
      )
    } else if (migrated.length && durationSeconds >= warningThreshold) {
      logger.warn(
        { durationSeconds, lockTtlSeconds, warningThreshold },
        'Migration success: NOTE THAT MIGRATIONS ARE APPROACHING LOCK TTL'
      )
    } else {
      // no-op for sonar
    }
  } catch (error) {
    logger.error(error, 'Migration failed')
    throw error
  }
}
