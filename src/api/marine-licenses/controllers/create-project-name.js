import Boom from '@hapi/boom'
import { createProjectName } from '../../../models/marine-licenses/project-name.js'
import { mcmsContext as mcmsContextPayload } from '../../../models/mcms-context.js'
import { StatusCodes } from 'http-status-codes'
import { getContactId } from '../../helpers/get-contact-id.js'
import { MARINE_LICENSE_STATUS } from '../../../common/constants/marine-license.js'
import { marineLicenses } from '../../../common/constants/db-collections.js'
import { transformMcmsContextForDb } from '../../../common/helpers/mcms/transform-mcms-for-db.js'

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

      let mcmsContext = null
      const { error } = mcmsContextPayload.validate(payload.mcmsContext, {
        abortEarly: false
      })
      if (error) {
        request.logger.info(
          {
            mcmsContext: payload.mcmsContext,
            validationError: error.message
          },
          'Validation failed for MCMS context'
        )
        mcmsContext = {
          iatQueryString: payload.mcmsContext.iatQueryString
        }
      } else {
        mcmsContext = transformMcmsContextForDb(payload.mcmsContext)
      }

      const contactId = getContactId(auth)

      const {
        projectName,
        createdBy,
        createdAt,
        updatedBy,
        updatedAt,
        organisationId,
        organisationName,
        userRelationshipType
      } = payload

      const result = await db.collection(marineLicenses).insertOne({
        projectName,
        createdBy,
        createdAt,
        updatedBy,
        updatedAt,
        status: MARINE_LICENSE_STATUS.DRAFT,
        contactId,
        mcmsContext,
        ...(organisationId
          ? {
              organisation: {
                id: organisationId,
                name: organisationName,
                userRelationshipType
              }
            }
          : {})
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
