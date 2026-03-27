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

      await logMigrationStatus(server.logger, db)
      await runMigrations(server.logger, db, client)

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

async function logMigrationStatus(logger, db) {
  try {
    const migrationStatus = await status(db)
    logger.info(migrationStatus, 'Migration status')
  } catch (error) {
    logger.error(error, 'Failed to get migration status')
    throw error
  }
}

async function runMigrations(logger, db, client) {
  try {
    const migrated = await up(db, client)
    if (migrated.length) {
      logger.info(migrated, `Migrations applied`)
    } else {
      logger.info('No pending migrations')
    }
  } catch (error) {
    logger.error(error, 'Migration failed')
    throw error
  }
}
