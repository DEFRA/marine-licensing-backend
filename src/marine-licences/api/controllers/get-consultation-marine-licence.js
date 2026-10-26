import { StatusCodes } from 'http-status-codes'
import { getConsulteeOrganisationIdFromAuthToken } from '../../../shared/helpers/is-consultee-user.js'
import { getMarineLicence } from '../../models/get-marine-licence.js'
import { MarineLicenceService } from '../services/marine-licence.service.js'
import { buildConsultationMarineLicenceResponse } from '../helpers/build-consultation-marine-licence-response.js'

export const getConsultationMarineLicenceController = {
  options: {
    validate: {
      params: getMarineLicence
    }
  },
  handler: async (request, h) => {
    const { db, auth, params } = request
    const organisationId = getConsulteeOrganisationIdFromAuthToken(auth)

    const marineLicenceService = new MarineLicenceService({ db })

    const marineLicence =
      await marineLicenceService.getConsultationMarineLicenceById({
        id: params.id,
        organisationId
      })

    return h
      .response({
        message: 'success',
        value: buildConsultationMarineLicenceResponse(
          marineLicence,
          request,
          organisationId
        )
      })
      .code(StatusCodes.OK)
  }
}
