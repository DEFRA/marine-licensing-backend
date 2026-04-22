import { createLogger } from '../src/shared/common/helpers/logging/logger.js'
import { collectionEmpQueue } from '../src/shared/common/constants/db-collections.js'

const logger = createLogger()
const logSystem = 'Migration:20260421120000-clear-exemption-emp-queue-refs'

const applicationReferenceNumbers = [
  'EXE/2026/11225',
  'EXE/2026/11226',
  'EXE/2026/11230',
  'EXE/2026/11231',
  'EXE/2026/11232'
]

/**
 * When this migration is applied (see `changelog`), removes rows from
 * `exemption-emp-queue` for the `applicationReferenceNumbers` above. For a
 * different set later, add a new migration; migrate-mongo does not re-run an
 * already-applied `up` function.
 */
export const up = async (db) => {
  const result = await db.collection(collectionEmpQueue).deleteMany({
    applicationReferenceNumber: { $in: applicationReferenceNumbers }
  })

  if (result.deletedCount > 0) {
    logger.info(
      {
        deletedCount: result.deletedCount,
        applicationReferenceNumbers,
        logSystem
      },
      `${logSystem} exemption-emp-queue: removed ${result.deletedCount} document(s)`
    )
  } else {
    logger.info(
      { deletedCount: 0, applicationReferenceNumbers, logSystem },
      `${logSystem} exemption-emp-queue: no documents removed for listed applicationReferenceNumbers`
    )
  }
}

export const down = async () => {}
