import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../../shared/common/helpers/logging/logger.js'
import { MAS_EVENT_ACTION } from '../../../constants/marine-licence.js'

export const updateTransferredMarineLicence = async (
  db,
  logger,
  { body, id }
) => {
  const { applicationReference, transferredDate, status } = body

  const updatedAt = new Date()

  let result
  try {
    result = await db.collection(collectionMarineLicences).updateOne(
      { applicationReference },
      {
        $set: {
          status,
          transferredDate,
          updatedAt,
          updatedBy: id
        }
      }
    )
  } catch (error) {
    logger.error(
      structureErrorForECS(error),
      `Failed to update marine licence for applicationReference ${applicationReference}; the queue will retry`
    )
    throw error
  }

  if (result.matchedCount === 0) {
    logger.warn(
      {
        event: {
          action: MAS_EVENT_ACTION.JOB_STALE,
          outcome: 'success',
          reference: applicationReference
        }
      },
      `No marine licence found for applicationReference ${applicationReference}`
    )
  }

  return result
}
