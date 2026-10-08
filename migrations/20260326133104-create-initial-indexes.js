import {
  collectionCoastalOperationsAreas,
  collectionDynamicsQueue,
  collectionDynamicsQueueFailed,
  collectionExemptions,
  collectionMarineLicences,
  collectionMarinePlanAreas
} from '../src/shared/common/constants/db-collections.js'
import { safeDropIndex } from './helpers/utils.js'

const marineLicenceDynamicsQueue = 'marine-licence-dynamics-queue'
const marineLicenceDynamicsQueueFailed = 'marine-licence-dynamics-queue-failed'

export const up = async (db, _client) => {
  await db.collection(collectionExemptions).createIndex({ id: 1 })
  await db
    .collection('reference-sequences')
    .createIndex({ key: 1 }, { unique: true })
  await db.collection(collectionDynamicsQueue).createIndex({ status: 1 })
  await db.collection(collectionDynamicsQueueFailed).createIndex({ id: 1 })
  await db.collection(marineLicenceDynamicsQueue).createIndex({ status: 1 })
  await db.collection(marineLicenceDynamicsQueueFailed).createIndex({ id: 1 })
  await db.collection(collectionMarineLicences).createIndex({ id: 1 })
  await db
    .collection(collectionCoastalOperationsAreas)
    .createIndex({ geometry: '2dsphere' })
  await db
    .collection(collectionMarinePlanAreas)
    .createIndex({ geometry: '2dsphere' })
}

export const down = async (db, _client) => {
  await safeDropIndex(db, collectionExemptions, 'id_1')
  await safeDropIndex(db, 'reference-sequences', 'key_1')
  await safeDropIndex(db, collectionDynamicsQueue, 'status_1')
  await safeDropIndex(db, collectionDynamicsQueueFailed, 'id_1')
  await safeDropIndex(db, marineLicenceDynamicsQueue, 'status_1')
  await safeDropIndex(db, marineLicenceDynamicsQueueFailed, 'id_1')
  await safeDropIndex(db, collectionMarineLicences, 'id_1')
  await safeDropIndex(db, collectionCoastalOperationsAreas, 'geometry_2dsphere')
  await safeDropIndex(db, collectionMarinePlanAreas, 'geometry_2dsphere')
}
