import { getJwtAuthStrategy } from '../../../plugins/auth.js'

export const isApplicantUser = (request) => {
  const authStrategy = getJwtAuthStrategy(request.auth?.artifacts?.decoded)
  return authStrategy === 'defraId'
}
