import {
  collectionCoastalOperationsAreas,
  collectionDynamicsQueue,
  collectionDynamicsQueueFailed,
  collectionExemptions,
  collectionMarineLicenceDynamicsQueue,
  collectionMarineLicenceDynamicsQueueFailed,
  collectionMarineLicences,
  collectionMarinePlanAreas
} from '../src/shared/common/constants/db-collections.js'

export const up = async (db) => {
  await db.collection('mongo-locks').createIndex({ id: 1 })
  await db.collection(collectionExemptions).createIndex({ id: 1 })
  await db
    .collection('reference-sequences')
    .createIndex({ key: 1 }, { unique: true })
  await db.collection(collectionDynamicsQueue).createIndex({ status: 1 })
  await db.collection(collectionDynamicsQueueFailed).createIndex({ id: 1 })
  await db
    .collection(collectionMarineLicenceDynamicsQueue)
    .createIndex({ status: 1 })
  await db
    .collection(collectionMarineLicenceDynamicsQueueFailed)
    .createIndex({ id: 1 })
  await db.collection(collectionMarineLicences).createIndex({ id: 1 })
  await db
    .collection(collectionCoastalOperationsAreas)
    .createIndex({ geometry: '2dsphere' })
  await db
    .collection(collectionMarinePlanAreas)
    .createIndex({ geometry: '2dsphere' })
}

export const down = async (db) => {
  await db.collection('mongo-locks').dropIndex('id_1')
  await db.collection(collectionExemptions).dropIndex('id_1')
  await db.collection('reference-sequences').dropIndex('key_1')
  await db.collection(collectionDynamicsQueue).dropIndex('status_1')
  await db.collection(collectionDynamicsQueueFailed).dropIndex('id_1')
  await db
    .collection(collectionMarineLicenceDynamicsQueue)
    .dropIndex('status_1')
  await db
    .collection(collectionMarineLicenceDynamicsQueueFailed)
    .dropIndex('id_1')
  await db.collection(collectionMarineLicences).dropIndex('id_1')
  await db
    .collection(collectionCoastalOperationsAreas)
    .dropIndex('geometry_2dsphere')
  await db.collection(collectionMarinePlanAreas).dropIndex('geometry_2dsphere')
}
