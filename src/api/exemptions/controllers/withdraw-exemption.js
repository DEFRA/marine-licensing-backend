import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getExemption } from '../../../models/get-exemption.js'
import { ObjectId } from 'mongodb'
import { authorizeOwnership } from '../../helpers/authorize-ownership.js'
import { EXEMPTION_STATUS } from '../../../common/constants/exemption.js'
import { collectionExemptions } from '../../../common/constants/db-collections.js'
import { config } from '../../../config.js'
import { addToDynamicsQueue } from '../../../common/helpers/dynamics/index.js'
import { DYNAMICS_REQUEST_ACTIONS } from '../../../common/constants/request-queue.js'

const updateExemptionRecord = async ({
  request,
  params,
  payload,
  withdrawnAt
}) => {
  const { db } = request
  const { id } = params
  const { updatedAt, updatedBy } = payload
  const exemption = await db.collection(collectionExemptions).findOneAndUpdate(
    { _id: ObjectId.createFromHexString(id) },
    {
      $set: {
        withdrawnAt,
        status: EXEMPTION_STATUS.WITHDRAWN,
        updatedAt,
        updatedBy
      }
    },
    { returnDocument: 'after' }
  )
  if (!exemption) {
    throw Boom.notFound('Exemption not found during update')
  }
  return exemption
}

export const withdrawExemptionController = {
  options: {
    pre: [{ method: authorizeOwnership(collectionExemptions) }],
    validate: {
      params: getExemption
    }
  },
  handler: async (request, h) => {
    try {
      const { params, payload } = request
      const { isDynamicsEnabled } = config.get('dynamics')

      const withdrawnAt = new Date()
      const exemption = await updateExemptionRecord({
        request,
        params,
        payload,
        withdrawnAt
      })

      if (isDynamicsEnabled) {
        await addToDynamicsQueue({
          request,
          applicationReference: exemption.applicationReference,
          action: DYNAMICS_REQUEST_ACTIONS.WITHDRAW
        })
      }

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
        `Error when attempting to withdraw exemption: ${error.message}`
      )
    }
  }
}
