import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getExemption } from '../../../models/get-exemption.js'
import { createTaskList } from '../helpers/createTaskList.js'
import { errorIfApplicantNotAuthorizedToViewExemption } from '../helpers/authorize-ownership.js'
import { getExemptionFromDb } from '../helpers/get-exemption-from-db.js'
import { errorIfSubmittedExemptionNotPublic } from '../helpers/error-if-submitted-exemption-not-public.js'

export const getExemptionController = ({ requiresAuth }) => ({
  options: {
    validate: {
      params: getExemption
    },
    ...(requiresAuth ? {} : { auth: false })
  },
  handler: async (request, h) => {
    try {
      const exemption = await getExemptionFromDb(request)

      if (requiresAuth) {
        await errorIfApplicantNotAuthorizedToViewExemption({
          request,
          exemption
        })
      } else {
        errorIfSubmittedExemptionNotPublic(exemption)
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
