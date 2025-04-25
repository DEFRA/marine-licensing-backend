import { health } from '../routes/health.js'
import { example } from '../routes/example.js'
import { exemptions } from '../api/exemptions/index.js'

const router = {
  plugin: {
    name: 'router',
    register: (server, _options) => {
      server.route([health].concat(example).concat(exemptions))
    }
  }
}

export { router }
