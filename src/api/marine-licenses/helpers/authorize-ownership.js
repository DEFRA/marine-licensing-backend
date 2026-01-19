import Boom from '@hapi/boom'
import { ObjectId } from 'mongodb'
import { getContactId } from '../../helpers/get-contact-id.js'

export const authorizeOwnership = async (request, h) => {
  const { payload, params, db, auth } = request
  const contactId = getContactId(auth)

  const id = params.id || payload?.id

  const document = await db
    .collection('marine-licenses')
    .findOne({ _id: ObjectId.createFromHexString(id) })

  if (!document) {
    throw Boom.notFound()
  }
  if (document.contactId !== contactId) {
    throw Boom.forbidden('Not authorized to request this resource')
  }

  return h.continue
}
