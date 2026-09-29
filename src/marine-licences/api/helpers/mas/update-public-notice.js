import { config } from '../../../../config.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../../shared/common/helpers/logging/logger.js'
import { MAS_EVENT_ACTION } from '../../../constants/marine-licence.js'

export const updatePublicNotice = async (db, logger, { body, id }) => {
  const { applicationReference, userName, userEmail } = body
  const frontEndBaseUrl = config.get('frontEndBaseUrl')

  const updatedAt = new Date()

  let result

  try {
    result = await db.collection(collectionMarineLicences).findOneAndUpdate(
      {
        applicationReference
      },
      {
        $set: {
          updatedAt,
          updatedBy: id
        }
      },
      { returnDocument: 'after' }
    )
  } catch (error) {
    logger.error(
      structureErrorForECS(error),
      `Failed to update marine licence for applicationReference ${applicationReference}; the queue will retry`
    )
    throw error
  }

  if (!result) {
    logger.warn(
      {
        event: {
          action: MAS_EVENT_ACTION.JOB_STALE,
          outcome: 'success'
        }
      },
      `No marine licence found for applicationReference ${applicationReference}`
    )
  } else {
    // send email after merging new helper
  }

  return result
}
