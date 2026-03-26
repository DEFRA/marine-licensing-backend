import Boom from '@hapi/boom'
import { otherAuthorities } from '../../models/other-authorities.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'

export const updateOtherAuthoritiesController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: otherAuthorities
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const { agree, details, id, updatedAt, updatedBy } = payload
      const result = await db.collection(collectionMarineLicences).updateOne(
        { _id: ObjectId.createFromHexString(id) },
        {
          $set: {
            otherAuthorities: { agree, details },
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
      throw Boom.internal(`Error updating other authorities: ${error.message}`)
    }
  }
}
