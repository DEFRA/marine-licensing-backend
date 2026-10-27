import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { getConsulteeOrganisationIdFromAuthToken } from '../../../shared/helpers/is-consultee-user.js'
import { getMarineLicence } from '../../models/get-marine-licence.js'
import { findConsultations } from '../helpers/find-consultations.js'

export const getConsultationController = {
  options: {
    validate: {
      params: getMarineLicence
    }
  },
  handler: async (request, h) => {
    const { db, auth, params } = request
    const organisationId = getConsulteeOrganisationIdFromAuthToken(auth)

    const [consultation] = await findConsultations(db, organisationId, {
      _id: ObjectId.createFromHexString(params.id)
    })

    if (!consultation) {
      throw Boom.notFound('Consultation not found')
    }

    return h
      .response({ message: 'success', value: { consultation } })
      .code(StatusCodes.OK)
  }
}
