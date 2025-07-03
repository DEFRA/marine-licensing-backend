import Boom from '@hapi/boom'
import { config } from '../../../config.js'

export const getContactId = (auth) => {
  const { authEnabled } = config.get('defraId')

  if (!authEnabled) {
    return ''
  }

  if (!auth?.credentials?.contactId) {
    throw Boom.unauthorized('User not authenticated')
  }
  return auth.credentials.contactId
}
