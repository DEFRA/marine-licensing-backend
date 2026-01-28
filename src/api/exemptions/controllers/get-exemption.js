import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getExemption } from '../../../models/get-exemption.js'
import { createTaskList } from '../helpers/createTaskList.js'
import { ExemptionService } from '../services/exemption.service.js'
import { isApplicantUser } from '../helpers/is-applicant-user.js'
import { getContactId } from '../../helpers/get-contact-id.js'
import { getOrganisationIdFromAuthToken } from '../helpers/get-organisation-from-token.js'

export const getExemptionController = ({ requiresAuth }) => ({
  options: {
    validate: {
      params: getExemption
    },
    ...(requiresAuth ? {} : { auth: false })
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

      const { _id, ...rest } = exemption
      const taskList = createTaskList(exemption)
      const response = { id: _id.toString(), ...rest, taskList }

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
