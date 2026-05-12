import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { iatAnswersIdParams } from '../../models/iat-answers.js'
import { collectionIatAnswers } from '../../../shared/common/constants/db-collections.js'

export const getIatAnswersController = {
  options: {
    auth: { mode: 'optional' },
    validate: {
      params: iatAnswersIdParams
    }
  },
  handler: async (request, h) => {
    try {
      const { params, db } = request
      const doc = await db
        .collection(collectionIatAnswers)
        .findOne({ _id: new ObjectId(params.id) })

      if (!doc) {
        throw Boom.notFound('IAT answers not found')
      }

      const { _id, ...rest } = doc
      return h
        .response({
          message: 'success',
          value: { id: _id.toString(), ...rest }
        })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error retrieving IAT answers: ${error.message}`)
    }
  }
}
