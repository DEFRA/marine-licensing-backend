import { collectionMarineLicences } from '../src/shared/common/constants/db-collections.js'
import { safeDropIndex } from './helpers/utils.js'

const INDEX_NAME = 'consultationRequests.consultees.organisationId_1'

export const up = async (db) => {
  await db
    .collection(collectionMarineLicences)
    .createIndex({ 'consultationRequests.consultees.organisationId': 1 })
}

export const down = async (db) => {
  await safeDropIndex(db, collectionMarineLicences, INDEX_NAME)
}
