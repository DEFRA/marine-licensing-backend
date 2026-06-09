import { safeDropIndex } from './helpers/utils.js'

const COLLECTION = 'iat-answers'

export const up = async (db, _client) => {
  await db.collection(COLLECTION).createIndex({ slug: 1 }, { unique: true })
}

export const down = async (db, _client) => {
  await safeDropIndex(db, COLLECTION, 'slug_1')
}
