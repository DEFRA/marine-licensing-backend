import { collectionIatAnswers } from '../src/shared/common/constants/db-collections.js'
import { safeDropIndex } from './helpers/utils.js'

export const up = async (db, _client) => {
  // Pre-condition: no documents with a missing or duplicate slug field.
  // If dev data from before the append-only refactor exists, run:
  //   db.collection('iat-answers').deleteMany({ slug: { $exists: false } })
  // before applying this migration. Real environments are unaffected
  // because iat-answers is only reachable behind the selfService.enabled
  // feature flag and was not seeded with pre-slug data.
  await db
    .collection(collectionIatAnswers)
    .createIndex({ slug: 1 }, { unique: true })
}

export const down = async (db, _client) => {
  await safeDropIndex(db, collectionIatAnswers, 'slug_1')
}
