import { collectionIatAnswers } from '../src/shared/common/constants/db-collections.js'
import { safeDropIndex } from './helpers/utils.js'

export const up = async (db, _client) => {
  await db
    .collection(collectionIatAnswers)
    .createIndex({ slug: 1 }, { unique: true })
}

export const down = async (db, _client) => {
  await safeDropIndex(db, collectionIatAnswers, 'slug_1')
}
