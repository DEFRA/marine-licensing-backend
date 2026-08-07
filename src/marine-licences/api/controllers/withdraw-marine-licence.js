import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { getMarineLicence } from '../../models/get-marine-licence.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

// Ownership is enforced by the authorizeOwnership pre-handler; matching on status here keeps
// the guard atomic, so a null result means the licence is not in the SUBMITTED state.
const updateMarineLicenceRecord = async ({
  request,
  params,
  payload,
  withdrawnAt
}) => {
  const { db } = request
  const { id } = params
  const { updatedAt, updatedBy } = payload ?? {}

  const marineLicence = await db
    .collection(collectionMarineLicences)
    .findOneAndUpdate(
      {
        _id: ObjectId.createFromHexString(id),
        status: MARINE_LICENCE_STATUS.SUBMITTED
      },
      {
        $set: {
          withdrawnAt,
          status: MARINE_LICENCE_STATUS.WITHDRAWN,
          updatedAt,
          updatedBy
        }
      },
      { returnDocument: 'after' }
    )

  if (!marineLicence) {
    throw Boom.badRequest(
      `Cannot withdraw marine licence as marine licence must be the status '${MARINE_LICENCE_STATUS.SUBMITTED}'.`
    )
  }

  return marineLicence
}

export const withdrawMarineLicenceController = {
  options: {
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      params: getMarineLicence
    }
  },
  handler: async (request, h) => {
    try {
      const { params, payload } = request

      const withdrawnAt = new Date()
      await updateMarineLicenceRecord({
        request,
        params,
        payload,
        withdrawnAt
      })

      request.logger.info(
        { event: { action: 'withdraw', outcome: 'success' } },
        `Marine licence withdrawn successfully: ${params.id}`
      )

      return h
        .response({
          message: 'success',
          value: {
            withdrawnAt: withdrawnAt.toISOString()
          }
        })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(
        `Error when attempting to withdraw marine licence: ${error.message}`
      )
    }
  }
}
