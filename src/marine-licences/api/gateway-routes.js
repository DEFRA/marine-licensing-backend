import { generateCoordinatesCsvPublicController } from './controllers/generate-coordinates-csv-public.js'

/**
 * Gateway / external consumer routes (auth: false).
 * Used by D365 and other non-frontend callers via the CDP gateway.
 */
export const marineLicenceGatewayRoutes = [
  {
    method: 'GET',
    path: '/public/marine-licence/{id}/generate-coordinates-csv',
    ...generateCoordinatesCsvPublicController
  }
]
