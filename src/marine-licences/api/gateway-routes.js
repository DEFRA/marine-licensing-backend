import { generateCoordinatesCsvPublicController } from './controllers/generate-coordinates-csv-public.js'
import { getMarineLicenceGatewayController } from './controllers/get-marine-licence-gateway.js'
import { getWfdDocumentDownloadUrlController } from './controllers/get-wfd-document-download-url.js'
import { buildWfdDocumentDownloadPathById } from '../constants/water-framework-directive.js'

/**
 * Gateway / external consumer routes (auth: false).
 * Used by D365 and other non-frontend callers via the CDP gateway.
 */
export const marineLicenceGatewayRoutes = [
  {
    method: 'GET',
    path: '/public/marine-licence/mas/{id}',
    ...getMarineLicenceGatewayController
  },
  {
    method: 'GET',
    path: '/public/marine-licence/{id}/generate-coordinates-csv',
    ...generateCoordinatesCsvPublicController
  },
  {
    method: 'GET',
    path: buildWfdDocumentDownloadPathById('{id}'),
    ...getWfdDocumentDownloadUrlController
  }
]
