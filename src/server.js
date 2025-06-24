import Hapi from '@hapi/hapi'

import { config } from './config.js'
import { defraId } from './common/helpers/auth/defra-id.js'
import { router } from './plugins/router.js'
import { requestLogger } from './common/helpers/logging/request-logger.js'
import { mongoDb } from './common/helpers/mongodb.js'
import { failAction } from './common/helpers/fail-action.js'
import { secureContext } from './common/helpers/secure-context/index.js'
import { pulse } from './common/helpers/pulse.js'
import { requestTracing } from './common/helpers/request-tracing.js'
import { setupProxy } from './common/helpers/proxy/setup-proxy.js'

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

  const isTest = config.get('isTest')

  const plugins = [
    requestLogger,
    requestTracing,
    secureContext,
    pulse,
    mongoDb,
    ...(!isTest ? [defraId] : []),
    router
  ]

  await server.register(plugins)

  return server
}

export { createServer }
