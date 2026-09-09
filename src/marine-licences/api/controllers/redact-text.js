import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { isEntraIdUser } from '../../../shared/helpers/is-entra-id-user.js'
import { redactText } from '../../models/redact-text.js'

export const redactTextController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    validate: {
      query: false,
      payload: redactText
    }
  },
  handler: async (request, h) => {
    if (!isEntraIdUser(request)) {
      throw Boom.forbidden('Not authorised to redact data')
    }

    try {
      const { payload, db } = request
      const { id, fieldKey, text, updatedAt, updatedBy } = payload
      const result = await db.collection(collectionMarineLicences).updateOne(
        { _id: ObjectId.createFromHexString(id) },
        {
          $set: {
            [`redactions.${fieldKey}`]: {
              redactedAt: updatedAt,
              redactedBy: updatedBy,
              redactedText: text
            }
          }
        }
      )
      if (result.matchedCount === 0) {
        throw Boom.notFound('Marine licence not found')
      }
      return h
        .response({
          message: 'success'
        })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error redacting data: ${error.message}`)
    }
  }
}
