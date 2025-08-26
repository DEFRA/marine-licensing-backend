import Boom from '@hapi/boom'
import { createProjectName } from '../../../models/project-name.js'
import { StatusCodes } from 'http-status-codes'
import { getContactId } from '../helpers/get-contact-id.js'
import { EXEMPTION_STATUS } from '../../../common/constants/exemption.js'

export const createProjectNameController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    validate: {
      query: false,
      payload: createProjectName
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db, auth } = request
      const contactId = getContactId(auth)

      const {
        projectName,
        createdBy,
        createdAt,
        updatedBy,
        updatedAt,
        mcmsContext
      } = payload

      const result = await db.collection('exemptions').insertOne({
        projectName,
        createdBy,
        createdAt,
        updatedBy,
        updatedAt,
        status: EXEMPTION_STATUS.DRAFT,
        contactId,
        mcmsContext
      })

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
