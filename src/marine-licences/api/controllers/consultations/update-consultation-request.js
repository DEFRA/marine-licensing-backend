import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { getConsulteeOrganisationIdFromAuthToken } from '../../../../shared/helpers/is-consultee-user.js'
import { updateConsultationRequestSchema } from '../../../models/consultation-request.js'
import {
  MAS_CONSULTATION_STATUS,
  MARINE_LICENCE_DYNAMICS_EVENT_ACTION
} from '../../../constants/marine-licence.js'
import { config } from '../../../../config.js'
import { addToDynamicsQueue } from '../../../../shared/common/helpers/dynamics/index.js'
import { structureErrorForECS } from '../../../../shared/common/helpers/logging/logger.js'
import {
  markFailedToSendToDynamics,
  outboundKey
} from '../../helpers/dynamics/worker-processor.js'
import {
  DYNAMICS_QUEUE_TYPES,
  DYNAMICS_REQUEST_ACTIONS
} from '../../../../shared/common/constants/request-queue.js'

const RESPONDABLE_STATUSES = [
  MAS_CONSULTATION_STATUS.RESPONSE_NEEDED,
  MAS_CONSULTATION_STATUS.NO_RESPONSE_NEEDED
]

const alreadyRespondedError = (id) =>
  Boom.conflict(
    `Consultation in Marine Licence ${id} has already been responded to`
  )

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
          consultationStatus: { $in: RESPONDABLE_STATUSES }
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
          'consultee.consultationStatus': { $in: RESPONDABLE_STATUSES }
        }
      ]
    }
  )

  if (matchedCount === 0) {
    throw alreadyRespondedError(id)
  }
}

const queueResponseForDynamics = async (
  request,
  { applicationReference, response, organisationId }
) => {
  const action = DYNAMICS_REQUEST_ACTIONS.SEND_CONSULTATION_RESPONSE
  try {
    await addToDynamicsQueue({
      request,
      applicationReference,
      action,
      type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE,
      response,
      organisationId
    })
  } catch (error) {
    request.logger.error(
      {
        ...structureErrorForECS(error),
        event: {
          action: MARINE_LICENCE_DYNAMICS_EVENT_ACTION.MARKED_FAILED,
          outcome: 'failure',
          reference: applicationReference,
          reason: 'Enqueue failed; no automatic retry'
        }
      },
      `Failed to queue consultation response for ${applicationReference} to Dynamics; marked failed`
    )
    await markFailedToSendToDynamics(
      request.db,
      applicationReference,
      outboundKey({ action, organisationId })
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
      const { id, response } = payload
      const organisationId = getConsulteeOrganisationIdFromAuthToken(auth)

      const marineLicenceId = ObjectId.createFromHexString(id)
      const marineLicences = db.collection(collectionMarineLicences)

      const marineLicence = await marineLicences.findOne(
        {
          _id: marineLicenceId,
          'consultationRequests.consultees.organisationId': organisationId
        },
        { projection: { applicationReference: 1, consultationRequests: 1 } }
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

      if (!RESPONDABLE_STATUSES.includes(consultationStatus)) {
        throw alreadyRespondedError(id)
      }

      await updateConsultee(request, {
        organisationId,
        consultationRequestIndex,
        marineLicenceId
      })

      const { isDynamicsEnabled } = config.get('dynamics')
      if (isDynamicsEnabled) {
        await queueResponseForDynamics(request, {
          applicationReference: marineLicence.applicationReference,
          response,
          organisationId
        })
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
