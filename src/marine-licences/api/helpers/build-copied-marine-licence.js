import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'

export const FIELDS_TO_DROP_ON_COPY = [
  '_id',
  'applicationReference',
  'submittedAt',
  'rejectedDate',
  'rejectedReasons',
  'rejectedInformation',
  'transferredDate',
  'coastalOperationsAreas',
  'marinePlanAreas'
]

export const buildCopiedMarineLicence = (
  source,
  { contactId, createdBy, createdAt, updatedBy, updatedAt }
) => {
  const copy = { ...source }

  for (const field of FIELDS_TO_DROP_ON_COPY) {
    delete copy[field]
  }

  if (copy.feeEstimate) {
    copy.feeEstimate = { ...copy.feeEstimate }
    delete copy.feeEstimate.accept
  }

  return {
    ...copy,
    status: MARINE_LICENCE_STATUS.DRAFT,
    contactId,
    createdBy,
    createdAt,
    updatedBy,
    updatedAt
  }
}
