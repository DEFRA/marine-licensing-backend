import Boom from '@hapi/boom'
import { projectName } from '../../../models/project-name.js'
import { StatusCodes } from 'http-status-codes'

export const createProjectNameController = {
  options: {
    validate: {
      query: false,
      payload: projectName
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request

      const result = await db
        .collection('exemptions')
        .insertOne({ projectName: payload.projectName })

      return h
        .response({
          message: 'success',
          value: { id: result.insertedId.toString() }
        })
        .code(StatusCodes.CREATED)
    } catch (error) {
      throw Boom.internal(`Error creating project name: ${error.message}`)
    }
  }
}
