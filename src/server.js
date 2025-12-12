import Hapi from '@hapi/hapi'

import { config } from './config.js'
import { router } from './plugins/router.js'
import { auth } from './plugins/auth.js'
import { processDynamicsQueuePlugin } from './plugins/dynamics.js'
import { processEmpQueuePlugin } from './plugins/emp.js'
import { requestLogger } from './common/helpers/logging/request-logger.js'
import { mongoDb } from './common/helpers/mongodb.js'
import { failAction } from './common/helpers/fail-action.js'
import { secureContext } from '@defra/hapi-secure-context'
import { pulse } from './common/helpers/pulse.js'
import { requestTracing } from './common/helpers/request-tracing.js'
import { setupProxy } from './common/helpers/proxy/setup-proxy.js'
import hapiAuthJwt2 from 'hapi-auth-jwt2'

async function createServer() {
  setupProxy()
  const server = Hapi.server({
    host: config.get('host'),
    port: config.get('port'),
    routes: {
      validate: {
        options: {
          abortEarly: false
        },
        failAction
      },
      security: {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false
        },
        xss: 'enabled',
        noSniff: true,
        xframe: true
      }
    },
    router: {
      stripTrailingSlash: true
    }
  })

  // Hapi Plugins:
  // requestTracing - trace header logging and propagation (add before requestLogger)
  // requestLogger  - automatically logs incoming requests
  // secureContext  - loads CA certificates from environment config
  // pulse          - provides shutdown handlers
  // mongoDb        - sets up mongo connection pool and attaches to `server` and `request` objects
  // auth           - JWT authentication strategy
  // router         - routes used in the app
  // processDynamicsQueuePlugin - polls exemption queue and syncs to Dynamics 365
  // processEmpQueuePlugin - polls exemption queue and syncs to "Explore Marine Planning"
  await server.register([
    requestTracing,
    requestLogger,
    secureContext,
    pulse,
    {
      plugin: mongoDb,
      options: config.get('mongo')
    },
    hapiAuthJwt2,
    auth,
    router,
    processDynamicsQueuePlugin,
    processEmpQueuePlugin
  ])

  return server
}

export { createServer }
