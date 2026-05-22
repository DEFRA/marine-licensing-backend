import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { iatAnswersSlugParams } from '../../models/iat-answers.js'
import { collectionIatAnswers } from '../../../shared/common/constants/db-collections.js'

export const getIatAnswersController = {
  options: {
    auth: { mode: 'optional' },
    validate: {
      params: iatAnswersSlugParams
    }
  },
  handler: async (request, h) => {
    try {
      const { params, db } = request
      const doc = await db
        .collection(collectionIatAnswers)
        .findOne({ slug: params.slug })

      if (!doc) {
        throw Boom.notFound('IAT answers not found')
      }

      const { _id, ...rest } = doc
      return h
        .response({ message: 'success', value: rest })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error retrieving IAT answers: ${error.message}`)
    }
  }
}
