import { marineLicenceFrontendRoutes } from './frontend-routes.js'
import { marineLicenceGatewayRoutes } from './gateway-routes.js'

export const marineLicences = [
  ...marineLicenceFrontendRoutes,
  ...marineLicenceGatewayRoutes
]
