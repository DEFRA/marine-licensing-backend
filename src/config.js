import convict from 'convict'
import convictFormatWithValidator from 'convict-format-with-validator'

import { convictValidateMongoUri } from './common/helpers/convict/validate-mongo-uri.js'

convict.addFormat(convictValidateMongoUri)
convict.addFormats(convictFormatWithValidator)

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'

const oneMinuteInMS = 60 * 1000

const config = convict({
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind',
    format: 'port',
    default: 3001,
    env: 'PORT'
  },
  serviceName: {
    doc: 'Api Service Name',
    format: String,
    default: 'marine-licensing-backend'
  },
  cdpEnvironment: {
    doc: 'The CDP environment the app is running in. With the addition of "local" for local development',
    format: [
      'local',
      'infra-dev',
      'management',
      'dev',
      'test',
      'perf-test',
      'ext-test',
      'prod'
    ],
    default: 'local',
    env: 'ENVIRONMENT'
  },
  defraId: {
    jwksUri: {
      doc: 'JWKS Token validation url',
      format: String,
      default: 'http://localhost:3200/cdp-defra-id-stub/.well-known/jwks.json',
      env: 'DEFRA_ID_JWKS_URI'
    },
    authEnabled: {
      doc: 'DEFRA ID Auth enabled',
      format: Boolean,
      env: 'DEFRA_ID_ENABLED',
      default: false
    }
  },
  log: {
    isEnabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: !isTest,
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Format to output logs in',
      format: ['ecs', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : ['req', 'res', 'responseTime']
    }
  },
  mongo: {
    uri: {
      doc: 'URI for mongodb',
      format: String,
      default: 'mongodb://127.0.0.1:27017',
      env: 'MONGO_URI'
    },
    databaseName: {
      doc: 'Database name for mongodb',
      format: String,
      default: 'marine-licensing-backend',
      env: 'MONGO_DATABASE'
    }
  },
  httpProxy: {
    doc: 'HTTP Proxy URL',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  isSecureContextEnabled: {
    doc: 'Enable Secure Context',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_SECURE_CONTEXT'
  },
  isMetricsEnabled: {
    doc: 'Enable metrics reporting',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_METRICS'
  },
  tracing: {
    header: {
      doc: 'CDP tracing header name',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  },
  dynamics: {
    clientId: {
      doc: 'The client ID.',
      format: String,
      default: '',
      env: 'DYNAMICS_CLIENT_ID'
    },
    clientSecret: {
      doc: 'The client secret.',
      format: String,
      default: 'test_value',
      env: 'DYNAMICS_CLIENT_SECRET'
    },
    tokenUrl: {
      doc: 'URL to get token for the Dynamics request',
      format: String,
      default:
        'https://login.microsoftonline.com/6f504113-6b64-43f2-ade9-242e05780007/oauth2/v2.0/token',
      env: 'DYNAMICS_TOKEN_URL'
    },
    scope: {
      doc: 'Scope for the Dynamics API access',
      format: String,
      default: 'https://service.flow.microsoft.com//.default',
      env: 'DYNAMICS_SCOPE'
    },
    apiUrl: {
      doc: 'URL for the Dynamics API',
      format: String,
      default: '',
      env: 'DYNAMICS_API_URL'
    },
    isEnabled: {
      doc: 'Is Dynamics integration enabled',
      format: Boolean,
      default: false,
      env: 'DYNAMICS_ENABLED'
    },
    maxRetries: {
      doc: 'Maximum number of retries for failed Dynamics queue items',
      format: Number,
      default: 3,
      env: 'DYNAMICS_MAX_RETRIES'
    },
    retryDelayMs: {
      doc: 'Delay in milliseconds before retrying a failed Dynamics queue item',
      format: Number,
      default: oneMinuteInMS,
      env: 'DYNAMICS_RETRY_DELAY_MS'
    }
  }
})

config.validate({ allowed: 'strict' })

export { config }
