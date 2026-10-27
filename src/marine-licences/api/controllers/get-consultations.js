import { StatusCodes } from 'http-status-codes'
import { getConsulteeOrganisationIdFromAuthToken } from '../../../shared/helpers/is-consultee-user.js'
import { findConsultations } from '../helpers/find-consultations.js'

export const getConsultationsController = {
  handler: async (request, h) => {
    const { db, auth } = request
    const organisationId = getConsulteeOrganisationIdFromAuthToken(auth)

    const consultations = (await findConsultations(db, organisationId)).sort(
      (a, b) => b.consultationStartDate.localeCompare(a.consultationStartDate)
    )

    return h
      .response({ message: 'success', value: { consultations } })
      .code(StatusCodes.OK)
  }
}
