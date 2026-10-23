import { StatusCodes } from 'http-status-codes'
import { getConsulteeOrganisationIdFromAuthToken } from '../../../shared/helpers/is-consultee-user.js'
import { getMarineLicence } from '../../models/get-marine-licence.js'
import { MarineLicenceService } from '../services/marine-licence.service.js'
import { buildMarineLicenceResponse } from '../helpers/build-marine-licence-response.js'

export const getConsultationMarineLicenceController = {
  options: {
    validate: {
      params: getMarineLicence
    }
  },
  handler: async (request, h) => {
    const { db, logger, auth, params } = request
    const organisationId = getConsulteeOrganisationIdFromAuthToken(auth)

    const marineLicence = await new MarineLicenceService({
      db,
      logger
    }).getConsultationMarineLicenceById({ id: params.id, organisationId })

    return h
      .response({
        message: 'success',
        value: buildMarineLicenceResponse(marineLicence, request)
      })
      .code(StatusCodes.OK)
  }
}
