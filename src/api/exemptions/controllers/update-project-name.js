import Boom from '@hapi/boom'
import { updateProjectName } from '../../../models/project-name.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'

export const updateProjectNameController = {
  options: {
    validate: {
      query: false,
      payload: updateProjectName
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request

      const { projectName, id } = payload

      const result = await db
        .collection('exemptions')
        .updateOne(
          { _id: ObjectId.createFromHexString(id) },
          { $set: { projectName } }
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
      throw Boom.internal(`Error updating project name: ${error.message}`)
    }
  }
}
