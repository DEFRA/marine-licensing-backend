import { safeDropIndex } from './helpers/utils.js'

const COLLECTION = 'exemptions'
const INDEX_NAME = 'status_1'

export const up = async (db) => {
  await db.collection(COLLECTION).createIndex({ status: 1 })
}

export const down = async (db) => {
  await safeDropIndex(db, COLLECTION, INDEX_NAME)
}
