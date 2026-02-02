import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getExemption } from '../../../models/get-exemption.js'
import { ObjectId } from 'mongodb'
import { authorizeOwnership } from '../../helpers/authorize-ownership.js'
import { EXEMPTION_STATUS } from '../../../common/constants/exemption.js'
import { collectionExemptions } from '../../../common/constants/db-collections.js'

const updateExemptionRecord = async ({
  request,
  params,
  payload,
  withdrawnAt
}) => {
  const { db } = request
  const { id } = params
  const { updatedAt, updatedBy } = payload
  const updateResult = await db.collection(collectionExemptions).updateOne(
    { _id: ObjectId.createFromHexString(id) },
    {
      $set: {
        withdrawnAt,
        status: EXEMPTION_STATUS.WITHDRAWN,
        updatedAt,
        updatedBy
      }
    }
  )
  if (updateResult.matchedCount === 0) {
    throw Boom.notFound('Exemption not found during update')
  }
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

      const withdrawnAt = new Date()
      await updateExemptionRecord({
        request,
        params,
        payload,
        withdrawnAt
      })

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
