import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../../shared/common/helpers/logging/logger.js'
import {
  MAS_CONSULTATION_APPLICATION_TYPES,
  MAS_CONSULTATION_STATUS,
  MAS_EVENT_ACTION
} from '../../../constants/marine-licence.js'

const withConsultationStatus = (consultee) => ({
  ...consultee,
  consultationStatus:
    consultee.consultationType ===
    MAS_CONSULTATION_APPLICATION_TYPES.APPLICATION_NOTIFICATION
      ? MAS_CONSULTATION_STATUS.NO_RESPONSE_NEEDED
      : MAS_CONSULTATION_STATUS.RESPONSE_NEEDED
})

export const addConsultationRequest = async (db, logger, { body, id }) => {
  const { applicationReference, consultationStartDate, consultees } = body

  const updatedAt = new Date()

  let result

  try {
    result = await db.collection(collectionMarineLicences).findOneAndUpdate(
      {
        applicationReference
      },
      {
        $addToSet: {
          consultationRequests: {
            consultationStartDate,
            consultees: consultees?.map(withConsultationStatus)
          }
        },
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
      `Failed to add consultation request for applicationReference ${applicationReference}; the queue will retry`
    )
    throw error
  }

  if (!result) {
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
