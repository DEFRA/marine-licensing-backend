import { cleanupTestDataController } from './controllers/cleanup-test-data.js'

/**
 * Journey-test cleanup routes. The router only registers these when
 * {@link import('./cleanup-test-data.js').isCleanupEndpointEnabled} is true
 * (CDP dev and test).
 */
export const testDataRoutes = [
  {
    method: 'POST',
    path: '/test-data/cleanup',
    ...cleanupTestDataController
  }
]
