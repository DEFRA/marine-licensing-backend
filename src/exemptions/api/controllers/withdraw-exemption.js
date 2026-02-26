import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getExemption } from '../../models/get-exemption.js'
import { ObjectId } from 'mongodb'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import { config } from '../../../config.js'
import { addToDynamicsQueue } from '../../../shared/common/helpers/dynamics/index.js'
import { addToEmpQueue } from '../../../shared/common/helpers/emp/index.js'
import {
  DYNAMICS_REQUEST_ACTIONS,
  EMP_REQUEST_ACTIONS
} from '../../../shared/common/constants/request-queue.js'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'

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

      const { isEmpEnabled } = config.get('exploreMarinePlanning')
      if (isEmpEnabled) {
        await addToEmpQueue({
          request,
          applicationReference: exemption.applicationReference,
          action: EMP_REQUEST_ACTIONS.WITHDRAW
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
