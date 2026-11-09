import Boom from '@hapi/boom'
import { config } from '../../../config.js'
import {
  collectionDynamicsQueue,
  collectionDynamicsQueueFailed,
  collectionEmpQueue,
  collectionEmpQueueFailed,
  collectionExemptions,
  collectionMarineLicences
} from '../../common/constants/db-collections.js'
import { CLEANUP_ENABLED_ENVIRONMENTS } from '../../common/constants/journey-test-cleanup.js'
import { createLogger } from '../../common/helpers/logging/logger.js'

const logger = createLogger()

const PROJECT_COLLECTIONS = [collectionExemptions, collectionMarineLicences]

const QUEUE_COLLECTIONS = [
  collectionEmpQueue,
  collectionEmpQueueFailed,
  collectionDynamicsQueue,
  collectionDynamicsQueueFailed
]

export const isCleanupEndpointEnabled = (
  environment = config.get('cdpEnvironment')
) => CLEANUP_ENABLED_ENVIRONMENTS.includes(environment)

const deleteFromCollections = async (db, collectionNames, filter) => {
  const results = await Promise.all(
    collectionNames.map(async (collectionName) => {
      const { deletedCount } = await db
        .collection(collectionName)
        .deleteMany(filter)
      return [collectionName, deletedCount]
    })
  )

  return Object.fromEntries(results)
}

const deleteAllTestData = (db) =>
  deleteFromCollections(db, [...PROJECT_COLLECTIONS, ...QUEUE_COLLECTIONS], {})

/**
 * Removes journey-test data from MongoDB.
 *
 * Registered only on CDP `dev`, where it deletes all exemptions, marine
 * licences, and related queue collections. Not available on `test` so shared
 * example data is preserved.
 */
export const cleanupTestData = async (db) => {
  const environment = config.get('cdpEnvironment')

  if (!isCleanupEndpointEnabled(environment)) {
    throw Boom.notFound()
  }

  const deleted = await deleteAllTestData(db)

  logger.info(
    {
      event: { action: 'cleanup-test-data', outcome: 'success' }
    },
    `Journey test data cleanup completed for ${environment} (contactId=all, deleted=${JSON.stringify(deleted)})`
  )

  return {
    environment,
    contactId: null,
    deleted
  }
}
