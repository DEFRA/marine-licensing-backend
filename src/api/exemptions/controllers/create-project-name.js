import Boom from '@hapi/boom'
import { projectName } from '../../../models/project-name.js'
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
      payload: projectName
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db, auth } = request
      const contactId = getContactId(auth)

      const result = await db.collection('exemptions').insertOne({
        projectName: payload.projectName,
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
