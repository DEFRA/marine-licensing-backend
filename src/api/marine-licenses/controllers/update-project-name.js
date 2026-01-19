import Boom from '@hapi/boom'
import { updateProjectName } from '../../../models/marine-licenses/project-name.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { authorizeOwnership } from '../helpers/authorize-ownership.js'

export const updateProjectNameController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership }],
    validate: {
      query: false,
      payload: updateProjectName
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request

      const { projectName, id, updatedAt, updatedBy } = payload

      const result = await db
        .collection('marine-licenses')
        .updateOne(
          { _id: ObjectId.createFromHexString(id) },
          { $set: { projectName, updatedAt, updatedBy } }
        )

      if (result.matchedCount === 0) {
        throw Boom.notFound('Marine license not found')
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
      throw Boom.internal(`Error updating project name: ${error.message}`)
    }
  }
}
