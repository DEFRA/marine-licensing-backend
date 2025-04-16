import joi from 'joi'

export const exemption = joi.object({
  projectName: joi.string().min(1).max(250).required().messages({
    'string.empty': 'PROJECT_NAME_REQUIRED',
    'string.max': 'PROJECT_NAME_MAX_LENGTH',
    'any.required': 'PROJECT_NAME_REQUIRED'
  })
})

export const createProjectNameController = {
  options: {
    validate: {
      query: false,
      payload: exemption
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request

      const { projectName } = payload

      const result = await db
        .collection('exemptions')
        .insertOne({ projectName })

      return h.response({ message: 'success', value: result }).code(200)
    } catch (error) {
      return h.response({ error: 'Error creating project name' }).code(500)
    }
  }
}
