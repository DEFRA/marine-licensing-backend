import Hapi from '@hapi/hapi'

import { config } from './config.js'
import { router } from './plugins/router.js'
import { auth } from './plugins/auth.js'
import { processExemptionsQueuePlugin } from './plugins/dynamics.js'
import { requestLogger } from './common/helpers/logging/request-logger.js'
import { mongoDb } from './common/helpers/mongodb.js'
import { failAction } from './common/helpers/fail-action.js'
import { secureContext } from './common/helpers/secure-context/index.js'
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
  // requestLogger  - automatically logs incoming requests
  // requestTracing - trace header logging and propagation
  // secureContext  - loads CA certificates from environment config
  // pulse          - provides shutdown handlers
  // mongoDb        - sets up mongo connection pool and attaches to `server` and `request` objects
  // auth           - JWT authentication strategy
  // router         - routes used in the app
  // processExemptionsQueuePlugin - polls exemption queue and syncs to Dynamics 365
  await server.register([
    requestLogger,
    requestTracing,
    secureContext,
    pulse,
    {
      plugin: mongoDb,
      options: config.get('mongo')
    },
    hapiAuthJwt2,
    auth,
    router,
    processExemptionsQueuePlugin
  ])

  return server
}

export { createServer }
