import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getMarineLicense } from '../../models/get-marine-license.js'
import { createTaskList } from '../helpers/createTaskList.js'
import { MarineLicenseService } from '../services/marine-license.service.js'
import { getContactId } from '../../../shared/helpers/get-contact-id.js'

export const getMarineLicenseController = {
  options: {
    validate: {
      params: getMarineLicense
    }
  },
  handler: async (request, h) => {
    try {
      const {
        params: { id },
        db,
        logger
      } = request
      const marineLicenseService = new MarineLicenseService({ db, logger })

      const currentUserId = getContactId(request.auth)
      const marineLicense = await marineLicenseService.getMarineLicenseById({
        id,
        currentUserId
      })

      const { _id, ...rest } = marineLicense
      const taskList = createTaskList(marineLicense)
      const response = { id: _id.toString(), ...rest, taskList }

      return h
        .response({ message: 'success', value: response })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error retrieving marine license: ${error.message}`)
    }
  }
}
