import { safeDropIndex } from './helpers/utils.js'

// Collection name is inlined rather than imported from src/: a migration is a
// frozen historical record, and importing a constant that could later be
// renamed would silently rewrite what an already-applied migration claims to
// have done.
const COLLECTION = 'exemptions'
const INDEX_NAME = 'status_1'

export const up = async (db) => {
  await db.collection(COLLECTION).createIndex({ status: 1 })
}

export const down = async (db) => {
  await safeDropIndex(db, COLLECTION, INDEX_NAME)
}
