import Boom from '@hapi/boom'

export const getContactId = (auth) => {
  if (!auth?.credentials?.contactId) {
    throw Boom.unauthorized('User not authenticated')
  }
  return auth.credentials.contactId
}

export const getOptionalContactId = (auth) => {
  return auth?.credentials?.contactId ?? null
}
