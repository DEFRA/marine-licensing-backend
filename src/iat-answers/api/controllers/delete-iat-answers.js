import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { iatAnswersIdParams } from '../../models/iat-answers.js'
import { collectionIatAnswers } from '../../../shared/common/constants/db-collections.js'

export const deleteIatAnswersController = {
  options: {
    auth: { mode: 'optional' },
    validate: {
      params: iatAnswersIdParams
    }
  },
  handler: async (request, h) => {
    try {
      const { params, db } = request
      await db
        .collection(collectionIatAnswers)
        .deleteOne({ _id: new ObjectId(params.id) })
      return h.response().code(StatusCodes.NO_CONTENT)
    } catch (error) {
      throw Boom.internal(`Error deleting IAT answers: ${error.message}`)
    }
  }
}
