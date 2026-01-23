import { health } from '../routes/health.js'
import { exemptions } from '../api/exemptions/index.js'
import { geoParser } from '../api/geo-parser/index.js'
import { marineLicenses } from '../api/marine-licenses/index.js'

const router = {
  plugin: {
    name: 'router',
    register: (server) => {
      server.route(
        [health].concat(exemptions).concat(geoParser).concat(marineLicenses)
      )
    }
  }
}

export { router }
