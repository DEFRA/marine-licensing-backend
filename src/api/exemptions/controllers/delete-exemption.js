import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getExemption } from '../../../models/get-exemption.js'
import { ObjectId } from 'mongodb'
import { authorizeOwnership } from '../helpers/authorize-ownership.js'

export const deleteExemptionController = {
  options: {
    pre: [{ method: authorizeOwnership }],
    validate: {
      params: getExemption
    }
  },
  handler: async (request, h) => {
    try {
      const { params, db } = request

      const result = await db
        .collection('exemptions')
        .deleteOne({ _id: ObjectId.createFromHexString(params.id) })

      if (result.deletedCount === 0) {
        throw Boom.notFound('Exemption not found')
      }

      return h
        .response({ message: 'Exemption deleted successfully' })
        .code(StatusCodes.OK)
    } catch (error) {
      throw Boom.internal(`Error deleting exemption: ${error.message}`)
    }
  }
}
