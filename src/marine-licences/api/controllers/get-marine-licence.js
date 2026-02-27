import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getMarineLicence } from '../../models/get-marine-licence.js'
import { createTaskList } from '../helpers/createTaskList.js'
import { MarineLicenceService } from '../services/marine-licence.service.js'
import { getContactId } from '../../../shared/helpers/get-contact-id.js'

export const getMarineLicenceController = {
  options: {
    validate: {
      params: getMarineLicence
    }
  },
  handler: async (request, h) => {
    try {
      const {
        params: { id },
        db,
        logger
      } = request
      const marineLicenceService = new MarineLicenceService({ db, logger })

      const currentUserId = getContactId(request.auth)
      const marineLicence = await marineLicenceService.getMarineLicenceById({
        id,
        currentUserId
      })

      const { _id, ...rest } = marineLicence
      const taskList = createTaskList(marineLicence)
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
}
