import { health } from '../routes/health.js'
import { example } from '../routes/example.js'
import { exemptions } from '../api/exemptions/index.js'

const router = {
  plugin: {
    name: 'router',
    register: (server, _options) => {
      server.route(
        [health]
          .concat(example)
          .concat(exemptions)
          .concat([
            {
              method: 'GET',
              path: '/exemption/project-name',
              options: {
                auth: 'defra-id'
              },
              handler: async (request, h) => {
                // now we know that the user is authenticated
                const user = request.auth.credentials.profile
                // return their email + a dummy project name:
                return h.response({
                  projectName: 'My Marine Exemption',
                  userEmail: user.email
                })
              }
            }
          ])
      )
    }
  }
}

export { router }
