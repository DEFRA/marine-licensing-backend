import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getExemption } from '../../models/get-exemption.js'
import { createTaskList } from '../helpers/createTaskList.js'
import { ExemptionService } from '../services/exemption.service.js'
import { getContactId } from '../../../shared/helpers/get-contact-id.js'
import { getOrganisationIdFromAuthToken } from '../../../shared/helpers/get-organisation-from-token.js'
import { EXEMPTION_STATUS_LABEL } from '../../constants/exemption.js'
import { isApplicantUser } from '../../../shared/helpers/is-applicant-user.js'
import { errorResponseSchema } from '../../../shared/models/error-response.js'
import { logResponseSchemaMismatch } from '../../../shared/common/helpers/log-response-schema-mismatch.js'
import { publicExemptionResponseSchema } from '../../models/public-exemption-response.js'

const publicRouteOptions = {
  auth: false,
  tags: ['api'],
  description: 'Get a publicly viewable exemption',
  notes:
    'Returns a submitted or withdrawn exemption whose applicant consented to publication on the public register.',
  response: {
    status: {
      200: publicExemptionResponseSchema,
      400: errorResponseSchema,
      403: errorResponseSchema,
      404: errorResponseSchema,
      500: errorResponseSchema
    },
    failAction: logResponseSchemaMismatch
  },
  plugins: {
    'hapi-swagger': {
      responses: {
        200: { description: 'The exemption' },
        400: { description: 'The id is not a 24-character hex string' },
        403: {
          description:
            'The exemption is not submitted or withdrawn, or the applicant did not consent to the public register'
        },
        404: { description: 'No exemption has this id' },
        500: { description: 'Unexpected server error' }
      }
    }
  }
}

export const getExemptionController = ({ requiresAuth }) => ({
  options: {
    validate: {
      params: getExemption
    },
    ...(requiresAuth ? {} : publicRouteOptions)
  },
  handler: async (request, h) => {
    try {
      const {
        params: { id },
        db,
        logger
      } = request
      const exemptionService = new ExemptionService({ db, logger })
      let exemption

      if (requiresAuth) {
        // if the user is an applicant, they can view their own exemptions or
        // submitted exemptions from their organisation (colleagues' work)
        // alternatively they're an internal user (logged in with entra ID) and
        // can view any exemption
        const isApplicant = isApplicantUser(request)
        const currentUserId = isApplicant ? getContactId(request.auth) : null
        const currentOrganisationId = isApplicant
          ? getOrganisationIdFromAuthToken(request.auth)
          : null
        exemption = await exemptionService.getExemptionById({
          id,
          currentUserId,
          currentOrganisationId
        })
      } else {
        exemption = await exemptionService.getPublicExemptionById(id)
      }

      const { _id, status, ...rest } = exemption
      const taskList = createTaskList(exemption)
      const response = {
        id: _id.toString(),
        ...rest,
        status: EXEMPTION_STATUS_LABEL[status] || status,
        taskList
      }

      return h
        .response({ message: 'success', value: response })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error retrieving exemption: ${error.message}`)
    }
  }
})
