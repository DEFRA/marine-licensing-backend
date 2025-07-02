import Boom from '@hapi/boom'
import { ObjectId } from 'mongodb'
import { getUserId } from './get-user-id.js'

export const authorizeOwnership = async (request, h) => {
  const { payload, params, db, auth } = request
  const userId = getUserId(auth)

  const id = params.id || payload?.id

  const document = await db
    .collection('exemptions')
    .findOne({ _id: ObjectId.createFromHexString(id) })

  if (!document) {
    throw Boom.notFound()
  }
  if (document.userId !== userId) {
    throw Boom.forbidden('Not authorized to update this resource')
  }

  return h.continue
}
