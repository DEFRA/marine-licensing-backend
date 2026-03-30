import Boom from '@hapi/boom'
import { publicRegister } from '../../models/public-register.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'

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
      const { consent, details, id, updatedAt, updatedBy } = payload
      const result = await db.collection(collectionMarineLicences).updateOne(
        { _id: ObjectId.createFromHexString(id) },
        {
          $set: {
            publicRegister: { consent, details },
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
        .code(StatusCodes.CREATED)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error updating public register: ${error.message}`)
    }
  }
}
