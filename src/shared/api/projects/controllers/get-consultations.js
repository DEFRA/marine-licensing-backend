import { StatusCodes } from 'http-status-codes'
import { collectionMarineLicences } from '../../../common/constants/db-collections.js'
import { getConsulteeOrganisationIdFromAuthToken } from '../../../helpers/is-consultee-user.js'

export const getConsultationsController = {
  handler: async (request, h) => {
    const { db, auth } = request
    const organisationId = getConsulteeOrganisationIdFromAuthToken(auth)

    const marineLicences = await db
      .collection(collectionMarineLicences)
      .find(
        { 'consultationRequests.consultees.organisationId': organisationId },
        {
          projection: {
            projectName: 1,
            applicationReference: 1,
            'consultationRequests.$': 1
          }
        }
      )
      .toArray()

    const projects = marineLicences
      .map(
        ({ _id, projectName, applicationReference, consultationRequests }) => {
          const [{ consultationStartDate, consultees }] = consultationRequests
          const { consultationType } = consultees.find(
            (consultee) => consultee.organisationId === organisationId
          )

          return {
            id: _id.toString(),
            projectName,
            applicationReference,
            consultationType,
            consultationStartDate
          }
        }
      )
      .sort((a, b) =>
        b.consultationStartDate.localeCompare(a.consultationStartDate)
      )

    return h
      .response({ message: 'success', value: { projects } })
      .code(StatusCodes.OK)
  }
}
