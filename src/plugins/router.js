import { health } from '../routes/health.js'
import { exemptions } from '../api/exemptions/index.js'
import { geoParser } from '../api/geo-parser/index.js'

const router = {
  plugin: {
    name: 'router',
    register: (server, _options) => {
      server.route([health].concat(exemptions).concat(geoParser))
    }
  }
}

export { router }
