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
import {
  CLEANUP_ENABLED_ENVIRONMENTS,
  JOURNEY_TEST_GOVERNMENT_GATEWAY_ID
} from '../../common/constants/journey-test-cleanup.js'
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

const emptyCounts = () =>
  Object.fromEntries(
    [...PROJECT_COLLECTIONS, ...QUEUE_COLLECTIONS].map((name) => [name, 0])
  )

const collectApplicationReferences = (projects) => [
  ...new Set(
    projects.map((project) => project.applicationReference).filter(Boolean)
  )
]

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

const deleteQueueItemsForReferences = async (db, applicationReferences) => {
  if (applicationReferences.length === 0) {
    return Object.fromEntries(QUEUE_COLLECTIONS.map((name) => [name, 0]))
  }

  return deleteFromCollections(db, QUEUE_COLLECTIONS, {
    applicationReferenceNumber: { $in: applicationReferences }
  })
}

const deleteAllTestData = (db) =>
  deleteFromCollections(db, [...PROJECT_COLLECTIONS, ...QUEUE_COLLECTIONS], {})

const summariseContactIds = async (db) => {
  const [exemptions, marineLicences] = await Promise.all([
    db
      .collection(collectionExemptions)
      .aggregate([
        {
          $group: {
            _id: '$contactId',
            count: { $sum: 1 },
            organisation: { $first: '$organisation.name' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ])
      .toArray(),
    db
      .collection(collectionMarineLicences)
      .aggregate([
        {
          $group: {
            _id: '$contactId',
            count: { $sum: 1 },
            organisation: { $first: '$organisation.name' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ])
      .toArray()
  ])

  return { exemptions, marineLicences }
}

const resolveTestContactId = async (db) => {
  const contactId = config.get('journeyTestContactId')

  if (contactId) {
    return contactId
  }

  const samples = await summariseContactIds(db)
  logger.error(
    {
      event: {
        action: 'cleanup-test-data',
        outcome: 'failure',
        reason: 'JOURNEY_TEST_CONTACT_ID is not configured'
      }
    },
    `JOURNEY_TEST_CONTACT_ID is not configured for Government Gateway ID ${JOURNEY_TEST_GOVERNMENT_GATEWAY_ID}. Distinct contactId samples: ${JSON.stringify(samples)}`
  )

  throw Boom.badImplementation(
    `JOURNEY_TEST_CONTACT_ID must be set for test cleanup (Government Gateway ID ${JOURNEY_TEST_GOVERNMENT_GATEWAY_ID}). Check logs for distinct contactId samples from MongoDB.`
  )
}

const deleteContactTestData = async (db, contactId) => {
  const contactFilter = { contactId }
  const deleted = emptyCounts()

  const projects = [
    ...(await db
      .collection(collectionExemptions)
      .find(contactFilter)
      .toArray()),
    ...(await db
      .collection(collectionMarineLicences)
      .find(contactFilter)
      .toArray())
  ]

  const applicationReferences = collectApplicationReferences(projects)
  Object.assign(
    deleted,
    await deleteQueueItemsForReferences(db, applicationReferences)
  )

  Object.assign(
    deleted,
    await deleteFromCollections(db, PROJECT_COLLECTIONS, contactFilter)
  )

  return deleted
}

/**
 * Removes journey-test data from MongoDB.
 *
 * - dev: deletes all exemptions, marine licences, and related queue collections
 * - test: deletes only documents for the configured journey-test contactId
 */
export const cleanupTestData = async (db) => {
  const environment = config.get('cdpEnvironment')

  if (!isCleanupEndpointEnabled(environment)) {
    throw Boom.notFound()
  }

  let deleted
  let contactId = null

  if (environment === 'dev') {
    deleted = await deleteAllTestData(db)
  } else {
    contactId = await resolveTestContactId(db)
    deleted = await deleteContactTestData(db, contactId)
  }

  logger.info(
    {
      event: { action: 'cleanup-test-data', outcome: 'success' }
    },
    `Journey test data cleanup completed for ${environment} (contactId=${contactId ?? 'all'}, deleted=${JSON.stringify(deleted)})`
  )

  return {
    environment,
    contactId,
    deleted
  }
}
