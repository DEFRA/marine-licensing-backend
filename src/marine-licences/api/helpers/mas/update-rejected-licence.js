import { config } from '../../../../config.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../../shared/common/helpers/logging/logger.js'
import {
  MARINE_LICENCE_STATUS,
  MAS_EVENT_ACTION
} from '../../../constants/marine-licence.js'
import { sendRejectedEmail } from './send-rejected-email.js'

export const updateRejectedMarineLicence = async (db, logger, { body, id }) => {
  const {
    applicationReference,
    rejectedDate,
    rejectedReasons,
    rejectedInformation,
    userName,
    userEmail
  } = body
  const frontEndBaseUrl = config.get('frontEndBaseUrl')

  const updatedAt = new Date()

  let result

  try {
    result = await db.collection(collectionMarineLicences).findOneAndUpdate(
      {
        applicationReference,
        status: { $ne: MARINE_LICENCE_STATUS.REJECTED }
      },
      {
        $set: {
          status: MARINE_LICENCE_STATUS.REJECTED,
          rejectedDate,
          rejectedReasons,
          rejectedInformation,
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
      `No marine licence found, or it is already rejected, for applicationReference ${applicationReference}`
    )
  } else {
    await sendRejectedEmail({
      db,
      userName,
      userEmail,
      applicationReference,
      viewDetailsUrl: `${frontEndBaseUrl}/marine-licence/view-details/${result._id}`
    })
  }

  return result
}
