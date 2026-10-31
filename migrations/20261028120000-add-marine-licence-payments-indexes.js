import { collectionMarineLicencePayments } from '../src/shared/common/constants/db-collections.js'
import { safeDropIndex } from './helpers/utils.js'

export const up = async (db) => {
  const payments = db.collection(collectionMarineLicencePayments)
  await payments.createIndex({ returnId: 1 }, { unique: true })
  await payments.createIndex({ applicationId: 1, finished: 1 })
  await payments.createIndex({ finished: 1, createdAt: 1 })
}

export const down = async (db) => {
  await safeDropIndex(db, collectionMarineLicencePayments, 'returnId_1')
  await safeDropIndex(
    db,
    collectionMarineLicencePayments,
    'applicationId_1_finished_1'
  )
  await safeDropIndex(
    db,
    collectionMarineLicencePayments,
    'finished_1_createdAt_1'
  )
}
