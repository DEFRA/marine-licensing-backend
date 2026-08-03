import { collectionMarineLicences } from '../src/shared/common/constants/db-collections.js'
import { safeDropIndex } from './helpers/utils.js'

export const up = async (db) => {
  await db
    .collection(collectionMarineLicences)
    .createIndex({ applicationReference: 1 }, { unique: true, sparse: true })
}

export const down = async (db) => {
  await safeDropIndex(db, collectionMarineLicences, 'applicationReference_1')
}
