import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { getConsulteeOrganisationIdFromAuthToken } from '../../../../shared/helpers/is-consultee-user.js'
import { updateConsultationRequestSchema } from '../../../models/consultation-request.js'
import { MAS_CONSULTATION_STATUS } from '../../../constants/marine-licence.js'

export const updateConsultationRequestController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    validate: {
      query: false,
      payload: updateConsultationRequestSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db, auth } = request
      const { id, response, updatedAt, updatedBy } = payload
      const organisationId = getConsulteeOrganisationIdFromAuthToken(auth)

      const result = await db.collection(collectionMarineLicences).updateOne(
        {
          _id: ObjectId.createFromHexString(id),
          'consultationRequests.consultees.organisationId': organisationId
        },
        {
          $set: {
            'consultationRequests.$.consultees.$[consultee].response': response,
            'consultationRequests.$.consultees.$[consultee].consultationStatus':
              MAS_CONSULTATION_STATUS.RESPONDED,
            updatedAt,
            updatedBy
          }
        },
        { arrayFilters: [{ 'consultee.organisationId': organisationId }] }
      )

      if (result.matchedCount === 0) {
        throw Boom.notFound(
          `Consultation not found in Marine Licence ${result.id}`
        )
      }

      return h.response({ message: 'success' }).code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(
        `Error updating consultation request: ${error.message}`
      )
    }
  }
}
