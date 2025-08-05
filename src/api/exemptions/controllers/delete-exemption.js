import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getExemption } from '../../../models/get-exemption.js'
import { ObjectId } from 'mongodb'
import { authorizeOwnership } from '../helpers/authorize-ownership.js'
import { EXEMPTION_STATUS } from '../../../common/constants/exemption.js'

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

      const exemption = await db
        .collection('exemptions')
        .findOne({ _id: ObjectId.createFromHexString(params.id) })

      if (!exemption) {
        throw Boom.notFound('Exemption not found')
      }

      if (exemption.status !== EXEMPTION_STATUS.DRAFT) {
        throw Boom.badRequest(
          `Cannot delete exemption as exemption must be the status '${EXEMPTION_STATUS.DRAFT}'.`
        )
      }

      await db
        .collection('exemptions')
        .deleteOne({ _id: ObjectId.createFromHexString(params.id) })

      return h
        .response({ message: 'Exemption deleted successfully' })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error deleting exemption: ${error.message}`)
    }
  }
}
