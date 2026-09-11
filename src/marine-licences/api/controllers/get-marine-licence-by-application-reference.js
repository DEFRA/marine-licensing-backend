import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getMarineLicenceByApplicationReference } from '../../models/get-marine-licence-by-application-reference.js'
import { MarineLicenceService } from '../services/marine-licence.service.js'
import { isEntraIdUser } from '../../../shared/helpers/is-entra-id-user.js'
import { buildMarineLicenceResponse } from '../helpers/build-marine-licence-response.js'

export const getMarineLicenceByApplicationReferenceController = {
  options: {
    validate: {
      params: getMarineLicenceByApplicationReference
    }
  },
  handler: async (request, h) => {
    if (!isEntraIdUser(request)) {
      throw Boom.forbidden('Not authorised to view this marine licence')
    }
    try {
      const {
        params: { applicationReference },
        db,
        logger
      } = request
      const marineLicenceService = new MarineLicenceService({ db, logger })
      const marineLicence =
        await marineLicenceService.getMarineLicenceByApplicationReference(
          applicationReference.replaceAll('-', '/')
        )
      const response = buildMarineLicenceResponse(marineLicence, request)

      return h
        .response({ message: 'success', value: response })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error retrieving marine licence: ${error.message}`)
    }
  }
}
