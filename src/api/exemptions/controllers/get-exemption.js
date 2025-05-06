import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getExemption } from '../../../models/get-exemption.js'
import { ObjectId } from 'mongodb'
import { createTaskList } from '../helpers/createTaskList.js'

export const getExemptionController = {
  options: {
    validate: {
      params: getExemption
    }
  },
  handler: async (request, h) => {
    try {
      const { params, db } = request

      const result = await db
        .collection('exemptions')
        .findOne({ _id: ObjectId.createFromHexString(params.id) })

      if (!result) {
        return Boom.notFound('Exemption not found')
      }

      const { _id, ...rest } = result

      const taskList = createTaskList(result)

      const response = { id: _id.toString(), ...rest, taskList }

      return h
        .response({ message: 'success', value: response })
        .code(StatusCodes.OK)
    } catch (error) {
      throw Boom.internal(`Error retrieving exemption: ${error.message}`)
    }
  }
}
