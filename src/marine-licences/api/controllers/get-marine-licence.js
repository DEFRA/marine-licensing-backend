import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getMarineLicence } from '../../models/get-marine-licence.js'
import { createTaskList } from '../helpers/createTaskList.js'
import { MarineLicenceService } from '../services/marine-licence.service.js'
import { getContactId } from '../../../shared/helpers/get-contact-id.js'
import { getOrganisationDetailsFromAuthToken } from '../../../shared/helpers/get-organisation-from-token.js'

export const getMarineLicenceController = ({ requiresAuth }) => ({
  options: {
    validate: {
      params: getMarineLicence
    },
    ...(requiresAuth ? {} : { auth: false })
  },
  handler: async (request, h) => {
    try {
      const {
        params: { id },
        db,
        logger,
        auth
      } = request
      const marineLicenceService = new MarineLicenceService({ db, logger })
      let marineLicence

      if (requiresAuth) {
        const currentUserId = getContactId(request.auth)
        marineLicence = await marineLicenceService.getMarineLicenceById({
          id,
          currentUserId
        })
      } else {
        marineLicence =
          await marineLicenceService.getPublicMarineLicenceById(id)
      }

      const { userRelationshipType } = getOrganisationDetailsFromAuthToken(auth)

      const isCitizen = userRelationshipType === 'Citizen'

      const { _id, ...rest } = marineLicence
      const taskList = createTaskList(marineLicence, isCitizen)
      const response = { id: _id.toString(), ...rest, taskList }

      return h
        .response({ message: 'success', value: response })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error retrieving marine licence: ${error.message}`)
    }
  }
})
