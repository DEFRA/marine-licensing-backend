import Boom from '@hapi/boom'
import { projectName as projectNameSchema } from '../../../models/project-name.js'
import { StatusCodes } from 'http-status-codes'
import { getContactId } from '../helpers/get-contact-id.js'
import {
  EXEMPTION_STATUS,
  EXEMPTION_TYPE
} from '../../../common/constants/exemption.js'

export const createProjectNameController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    validate: {
      query: false,
      payload: projectNameSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db, auth } = request
      const contactId = getContactId(auth)

      const { projectName, createdBy, createdAt, updatedBy, updatedAt } =
        payload

      const result = await db.collection('exemptions').insertOne({
        projectName,
        createdBy,
        createdAt,
        updatedBy,
        updatedAt,
        status: EXEMPTION_STATUS.DRAFT,
        type: EXEMPTION_TYPE.EXEMPT_ACTIVITY,
        contactId
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
