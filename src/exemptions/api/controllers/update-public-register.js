import Boom from '@hapi/boom'
import { publicRegister } from '../../models/public-register.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'

export const updatePublicRegisterController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionExemptions) }],
    validate: {
      query: false,
      payload: publicRegister
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request

      const { reason, consent, id, updatedAt, updatedBy } = payload

      const result = await db.collection(collectionExemptions).updateOne(
        { _id: ObjectId.createFromHexString(id) },
        {
          $set: { publicRegister: { reason, consent }, updatedAt, updatedBy }
        }
      )

      if (result.matchedCount === 0) {
        throw Boom.notFound('Exemption not found')
      }

      return h
        .response({
          message: 'success'
        })
        .code(StatusCodes.CREATED)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(`Error updating public register: ${error.message}`)
    }
  }
}
