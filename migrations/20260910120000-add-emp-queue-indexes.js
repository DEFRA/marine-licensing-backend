import { safeDropIndex } from './helpers/utils.js'

const COLLECTION = 'exemption-emp-queue'
const CLAIM_INDEX_NAME = 'status_1_updatedAt_1'
const REFERENCE_INDEX_NAME = 'applicationReferenceNumber_1'

export const up = async (db) => {
  await db.collection(COLLECTION).createIndex({ status: 1, updatedAt: 1 })
  await db.collection(COLLECTION).createIndex({ applicationReferenceNumber: 1 })
}

export const down = async (db) => {
  await safeDropIndex(db, COLLECTION, CLAIM_INDEX_NAME)
  await safeDropIndex(db, COLLECTION, REFERENCE_INDEX_NAME)
}
