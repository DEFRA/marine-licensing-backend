import { collectionMarineLicences } from '../src/shared/common/constants/db-collections.js'
import { MARINE_LICENCE_STATUS } from '../src/marine-licences/constants/marine-licence.js'

// Non-production only: marine licences were never live in prod. Deliberately leaves updatedAt alone,
// because it is the optimistic-concurrency token.
export const up = async (db) => {
  await db.collection(collectionMarineLicences).updateMany(
    {
      status: MARINE_LICENCE_STATUS.DRAFT,
      'publicRegister.withholdConsent': 'yes',
      'publicRegister.withholdReason': { $exists: false }
    },
    { $unset: { publicRegister: '' } }
  )
}

export const down = async () => {}
