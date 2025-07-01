import Boom from '@hapi/boom'

export const getUserId = (auth) => {
  if (!auth.credentials || !auth.credentials.userId) {
    throw Boom.unauthorized('User not authenticated')
  }
  return auth.credentials.userId
}
