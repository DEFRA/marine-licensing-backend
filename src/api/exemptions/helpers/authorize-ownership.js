import Boom from '@hapi/boom'
import { ObjectId } from 'mongodb'
import { getContactId } from './get-contact-id.js'
import { getJwtAuthStrategy } from '../../../plugins/auth.js'

export const authorizeOwnership = async (request, h) => {
  const { payload, params, db, auth } = request
  const contactId = getContactId(auth)

  const id = params.id || payload?.id

  const document = await db
    .collection('exemptions')
    .findOne({ _id: ObjectId.createFromHexString(id) })

  if (!document) {
    throw Boom.notFound()
  }
  if (document.contactId !== contactId) {
    throw Boom.notFound('Not authorized to request this resource')
  }

  return h.continue
}

export const isUserAuthorizedToViewExemption = async ({
  request,
  exemption
}) => {
  const authStrategy = getJwtAuthStrategy(request.auth?.artifacts?.decoded)
  if (authStrategy === 'defraId') {
    const contactId = getContactId(request.auth)
    if (exemption.contactId !== contactId) {
      throw Boom.forbidden('Not authorized to request this resource')
    }
  }
}
