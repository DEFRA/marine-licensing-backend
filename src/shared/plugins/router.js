import { health } from '../routes/health.js'
import { exemptions } from '../../exemptions/api/index.js'
import { projects } from '../api/projects/index.js'
import { geoParser } from '../api/geo-parser/index.js'
import { marineLicences } from '../../marine-licences/api/index.js'
import { iatContexts } from '../../iat-contexts/api/index.js'
import { iatOutcomeDocuments } from '../../iat-outcome-documents/api/index.js'
import { testDataRoutes } from '../api/test-data/index.js'
import { isCleanupEndpointEnabled } from '../api/test-data/cleanup-test-data.js'

const router = {
  plugin: {
    name: 'router',
    register: (server) => {
      server.route(
        [health]
          .concat(exemptions)
          .concat(projects)
          .concat(geoParser)
          .concat(marineLicences)
          .concat(iatContexts)
          .concat(iatOutcomeDocuments)
          .concat(isCleanupEndpointEnabled() ? testDataRoutes : [])
      )
    }
  }
}

export { router }
