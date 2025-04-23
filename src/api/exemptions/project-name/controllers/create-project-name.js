import { projectName } from '../../../../models/project-name.js'

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

      const { projectName } = payload

      const result = await db
        .collection('exemptions')
        .insertOne({ projectName })

      return h.response({ message: 'success', value: result }).code(201)
    } catch (error) {
      return h.response({ error: 'Error creating project name' }).code(500)
    }
  }
}
