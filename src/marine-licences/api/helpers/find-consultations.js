import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

export const findConsultations = async (db, organisationId, filter = {}) => {
  const marineLicences = await db
    .collection(collectionMarineLicences)
    .find(
      {
        ...filter,
        'consultationRequests.consultees.organisationId': organisationId
      },
      {
        projection: {
          projectName: 1,
          applicationReference: 1,
          'consultationRequests.$': 1
        }
      }
    )
    .toArray()

  return marineLicences.map(
    ({ _id, projectName, applicationReference, consultationRequests }) => {
      const [{ consultationStartDate, consultees }] = consultationRequests
      const { consultationType, consultationStatus } = consultees.find(
        (consultee) => consultee.organisationId === organisationId
      )

      return {
        id: _id.toString(),
        projectName,
        applicationReference,
        consultationType,
        consultationStatus,
        consultationStartDate
      }
    }
  )
}
