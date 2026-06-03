import { getJwtAuthStrategy } from '../plugins/auth.js'

export const isEntraIdUser = (request) => {
  const authStrategy = getJwtAuthStrategy(request.auth?.artifacts?.decoded)
  return authStrategy === 'entraId'
}
