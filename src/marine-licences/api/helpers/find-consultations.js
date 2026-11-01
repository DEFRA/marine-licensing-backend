import Boom from '@hapi/boom'
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
      const consultee = consultees.find(
        (consulteeInOrganisation) =>
          consulteeInOrganisation.organisationId === organisationId
      )
      if (!consultee) {
        throw Boom.badRequest('Consultee not found for this organisation')
      }
      const { consultationType, consultationStatus, response } = consultee

      return {
        id: _id.toString(),
        projectName,
        applicationReference,
        consultationType,
        consultationStatus,
        consultationStartDate,
        response
      }
    }
  )
}
