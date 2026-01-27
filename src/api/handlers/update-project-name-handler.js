import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'

export const updateProjectNameHandler = ({ collectionName, entityType }) => {
  return async (request, h) => {
    try {
      const { payload, db } = request

      const { projectName, id, updatedAt, updatedBy } = payload

      const result = await db
        .collection(collectionName)
        .updateOne(
          { _id: ObjectId.createFromHexString(id) },
          { $set: { projectName, updatedAt, updatedBy } }
        )

      if (result.matchedCount === 0) {
        throw Boom.notFound(`${entityType} not found`)
      }

      return h
        .response({
          message: 'success'
        })
        .code(StatusCodes.CREATED)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(
        `Error updating project name for ${entityType}: ${error.message}`
      )
    }
  }
}
