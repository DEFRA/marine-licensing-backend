import { collectionMarineLicences } from '../src/shared/common/constants/db-collections.js'

// Non-production only: marine licences were never live in prod, so this is a no-op there. Flags licences
// already sent via the old Mongo queue so the SQS worker doesn't hold their withdrawals waiting for a submit.
const legacyQueue = 'marine-licence-dynamics-queue'
const backfilledActions = ['submit', 'withdraw']

export const up = async (db) => {
  const rows = db
    .collection(legacyQueue)
    .find(
      { status: 'success', action: { $in: backfilledActions } },
      { projection: { applicationReferenceNumber: 1, action: 1 } }
    )

  const operations = []
  for await (const { applicationReferenceNumber, action } of rows) {
    const field = `dynamicsOutbound.${action}`
    operations.push({
      updateOne: {
        filter: {
          applicationReference: applicationReferenceNumber,
          [field]: { $ne: 'sent' }
        },
        update: { $set: { [field]: 'sent' } }
      }
    })
  }

  if (operations.length > 0) {
    await db
      .collection(collectionMarineLicences)
      .bulkWrite(operations, { ordered: false })
  }
}

export const down = async () => {}
