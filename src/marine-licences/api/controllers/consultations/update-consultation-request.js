import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { getConsulteeOrganisationIdFromAuthToken } from '../../../../shared/helpers/is-consultee-user.js'
import { updateConsultationRequestSchema } from '../../../models/consultation-request.js'
import { MAS_CONSULTATION_STATUS } from '../../../constants/marine-licence.js'

const updateConsultee = async (
  request,
  { organisationId, consultationRequestIndex, marineLicenceId }
) => {
  const { payload, db } = request
  const { id, response, updatedAt, updatedBy } = payload

  const marineLicences = db.collection(collectionMarineLicences)

  const consulteeToUpdate = `consultationRequests.${consultationRequestIndex}.consultees`

  const { matchedCount } = await marineLicences.updateOne(
    {
      _id: marineLicenceId,
      [consulteeToUpdate]: {
        $elemMatch: {
          organisationId,
          consultationStatus: MAS_CONSULTATION_STATUS.RESPONSE_NEEDED
        }
      }
    },
    {
      $set: {
        [`${consulteeToUpdate}.$[consultee].response`]: response,
        [`${consulteeToUpdate}.$[consultee].consultationStatus`]:
          MAS_CONSULTATION_STATUS.RESPONDED,
        updatedAt,
        updatedBy
      }
    },
    {
      arrayFilters: [
        {
          'consultee.organisationId': organisationId,
          'consultee.consultationStatus':
            MAS_CONSULTATION_STATUS.RESPONSE_NEEDED
        }
      ]
    }
  )

  if (matchedCount === 0) {
    throw Boom.conflict(
      `Consultation in Marine Licence ${id} does not need a response`
    )
  }
}

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
      const { id } = payload
      const organisationId = getConsulteeOrganisationIdFromAuthToken(auth)

      const marineLicenceId = ObjectId.createFromHexString(id)
      const marineLicences = db.collection(collectionMarineLicences)

      const marineLicence = await marineLicences.findOne(
        {
          _id: marineLicenceId,
          'consultationRequests.consultees.organisationId': organisationId
        },
        { projection: { consultationRequests: 1 } }
      )

      if (!marineLicence) {
        throw Boom.notFound(`Consultation not found in Marine Licence ${id}`)
      }

      const isOrganisation = (consultee) =>
        consultee.organisationId === organisationId
      const { consultationRequests } = marineLicence
      const consultationRequestIndex = consultationRequests.findIndex(
        ({ consultees }) => consultees.some(isOrganisation)
      )
      const { consultationStatus } =
        consultationRequests[consultationRequestIndex].consultees.find(
          isOrganisation
        )

      if (consultationStatus !== MAS_CONSULTATION_STATUS.RESPONSE_NEEDED) {
        throw Boom.conflict(
          `Consultation in Marine Licence ${id} does not need a response`
        )
      }

      await updateConsultee(request, {
        organisationId,
        consultationRequestIndex,
        marineLicenceId
      })

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
