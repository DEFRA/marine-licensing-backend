import Boom from '@hapi/boom'
import { waterFrameworkDirectiveSchema } from '../../models/water-framework-directive/water-framework-directive.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { validateWfdUpload } from '../helpers/validateWfdUpload.js'

export const updateWaterFrameworkDirectiveController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: waterFrameworkDirectiveSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request

      const { waterFrameworkDirective, id, updatedAt, updatedBy } = payload

      if (waterFrameworkDirective.nauticalMile !== 'no') {
        await validateWfdUpload(waterFrameworkDirective)
      }

      await db.collection(collectionMarineLicences).updateOne(
        { _id: ObjectId.createFromHexString(id) },
        {
          $set: {
            waterFrameworkDirective,
            updatedAt,
            updatedBy
          }
        }
      )

      return h
        .response({
          message: 'success'
        })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(
        `Error updating water framework directive: ${error.message}`
      )
    }
  }
}
