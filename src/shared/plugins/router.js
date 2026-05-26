import { health } from '../routes/health.js'
import { exemptions } from '../../exemptions/api/index.js'
import { projects } from '../api/projects/index.js'
import { geoParser } from '../api/geo-parser/index.js'
import { marineLicences } from '../../marine-licences/api/index.js'

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
      )
    }
  }
}

export { router }
