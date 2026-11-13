import Boom from '@hapi/boom'
import { publicRegister } from '../../models/public-register.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { PUBLIC_REGISTER_WITHHOLD_REASON } from '../../constants/marine-licence.js'

const buildPublicRegisterUpdate = ({ withholdConsent, withholdReason }) =>
  withholdReason === PUBLIC_REGISTER_WITHHOLD_REASON.NATIONAL_SECURITY
    ? {
        'publicRegister.withholdConsent': withholdConsent,
        'publicRegister.withholdReason': withholdReason
      }
    : { publicRegister: { withholdConsent, withholdReason } }

export const updatePublicRegisterController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: publicRegister
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { id, updatedAt, updatedBy } = payload
      const result = await db.collection(collectionMarineLicences).updateOne(
        { _id: ObjectId.createFromHexString(id) },
        {
          $set: {
            ...buildPublicRegisterUpdate(payload),
            updatedAt,
            updatedBy
          }
        }
      )
      if (result.matchedCount === 0) {
        throw Boom.notFound('Marine licence not found')
      }
      return h
        .response({
          message: 'success'
        })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error updating public register: ${error.message}`)
    }
  }
}
