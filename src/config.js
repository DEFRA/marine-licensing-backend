import convict from 'convict'
import convictFormatWithValidator from 'convict-format-with-validator'

import { convictValidateMongoUri } from './shared/common/helpers/convict/validate-mongo-uri.js'
import { configDotenv } from 'dotenv'

convict.addFormat(convictValidateMongoUri)
convict.addFormats(convictFormatWithValidator)

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const isDevelopment = process.env.NODE_ENV === 'development'

// Only load dotenv for local development
if (isDevelopment) {
  configDotenv()
}

const oneMinuteInMS = 60 * 1000

/** Default minutes before a stuck `in_progress` Dynamics queue item may be reclaimed. */
const dynamicsQueueClaimStaleDefaultMinutes = 30

// Custom convict format that requires an env var override for vars that have non-prod default values set.
// Applied to sensitive configs like API URLs, credentials, and service endpoints.
const requiredFromEnvInCdp = 'required-from-env-in-cdp'

export const isCdpProductionLikeEnvironment = (env) =>
  ['prod', 'perf-test', 'test'].includes(env)

export const isNotCdpProductionLikeEnvironment = (env) =>
  !isCdpProductionLikeEnvironment(env)

/**
 * 'required-from-env-in-cdp' format: When you must have an env var override the default value.
 * This is used for sensitive vars that take local-config default values and the prod values MUST come from the
 * environment.
 *
 * This is concerned with cdpEnvironments: prod (which is production), and perf-test (which is the equivalent of
 * pre-production), and test.
 */
convict.addFormat({
  name: requiredFromEnvInCdp,
  validate: function (val, schema) {
    const env = process.env.ENVIRONMENT ?? 'local'
    // Validate that `requiredFromEnvInCdp` env vars are set from the environment on these CDP environments
    if (isNotCdpProductionLikeEnvironment(env)) {
      return
    }

    const invalidValues = schema.default === undefined ? [] : [schema.default] // never allow the default
    invalidValues.push('') // dont allow empty strings

    if (invalidValues.includes(val)) {
      throw new Error(
        `${schema.env || 'Configuration value'} must be set for ${env} environment (current value is invalid for production)`
      )
    }
  }
})

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
  frontEndBaseUrl: {
    doc: 'Base URL for the front end application',
    format: requiredFromEnvInCdp,
    default: 'http://localhost:3000',
    env: 'FRONTEND_BASE_URL'
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
      doc: 'Defra ID JWKS Token validation url',
      format: requiredFromEnvInCdp,
      default: 'http://localhost:3200/cdp-defra-id-stub/.well-known/jwks.json',
      env: 'DEFRA_ID_JWKS_URI'
    }
  },
  entraId: {
    jwksUri: {
      doc: 'Entra ID JWKS Token validation url',
      format: String,
      default: 'https://login.microsoftonline.com/common/discovery/keys',
      env: 'ENTRA_ID_JWKS_URI'
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
    mongoUrl: {
      doc: 'URI for mongodb',
      format: requiredFromEnvInCdp,
      default: 'mongodb://127.0.0.1:27017/',
      env: 'MONGO_URI'
    },
    databaseName: {
      doc: 'Database name for mongodb',
      format: String,
      default: 'marine-licensing-backend',
      env: 'MONGO_DATABASE'
    },
    mongoOptions: {
      retryWrites: {
        doc: 'Enable Mongo write retries, overrides mongo URI when set.',
        format: Boolean,
        default: null,
        nullable: true,
        env: 'MONGO_RETRY_WRITES'
      },
      readPreference: {
        doc: 'Mongo read preference, overrides mongo URI when set.',
        format: [
          'primary',
          'primaryPreferred',
          'secondary',
          'secondaryPreferred',
          'nearest'
        ],
        default: 'primary',
        nullable: true,
        env: 'MONGO_READ_PREFERENCE'
      }
    }
  },
  httpProxy: {
    doc: 'HTTP Proxy URL',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
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
  aws: {
    region: {
      doc: 'AWS region',
      format: String,
      default: 'eu-west-2',
      env: 'AWS_REGION'
    },
    s3: {
      endpoint: {
        doc: 'AWS S3 Endpoint',
        format: requiredFromEnvInCdp,
        default: 'http://localhost:4566',
        env: 'S3_ENDPOINT' // defined globally in CDP
      },
      timeout: {
        doc: 'S3 operation timeout in milliseconds',
        format: Number,
        default: 30_000,
        env: 'AWS_S3_TIMEOUT'
      }
    }
  },
  cdp: {
    uploadBucket: {
      doc: 'S3 bucket for file uploads - required for S3 bucket validation',
      format: requiredFromEnvInCdp,
      default: 'mmo-uploads',
      env: 'CDP_UPLOAD_BUCKET'
    },
    maxFileSize: {
      doc: 'Maximum file size in bytes',
      format: Number,
      default: 50_000_000,
      env: 'MAX_FILE_SIZE'
    }
  },
  dynamics: {
    projects: {
      clientId: {
        doc: 'Dynamics client ID shared across projects (exemptions and marine licences)',
        format: requiredFromEnvInCdp,
        default: '',
        env: 'DYNAMICS_CLIENT_ID'
      },
      clientSecret: {
        doc: 'Dynamics client secret shared across projects',
        format: requiredFromEnvInCdp,
        default: '',
        env: 'DYNAMICS_CLIENT_SECRET'
      },
      scope: {
        doc: 'Dynamics API scope shared across projects',
        format: String,
        default: 'https://service.flow.microsoft.com//.default',
        env: 'DYNAMICS_SCOPE'
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
      },
      claimStaleMs: {
        doc: 'After this many milliseconds in in_progress (without success/failure), a queue item may be claimed by another worker. Set higher than the longest expected Dynamics call to avoid duplicate sends.',
        format: Number,
        default: dynamicsQueueClaimStaleDefaultMinutes * oneMinuteInMS,
        env: 'DYNAMICS_CLAIM_STALE_MS'
      }
    },
    exemptions: {
      apiUrl: {
        doc: 'URL for the Dynamics API to send an exemption',
        format: requiredFromEnvInCdp,
        default: '',
        env: 'DYNAMICS_API_URL'
      },
      withdrawUrl: {
        doc: 'URL for the Dynamics API to withdraw exemption',
        format: requiredFromEnvInCdp,
        default: '',
        env: 'DYNAMICS_API_WITHDRAW_URL'
      },
      updateUrl: {
        doc: 'URL for the Dynamics API to update an exemption',
        format: requiredFromEnvInCdp,
        default: '',
        env: 'DYNAMICS_API_UPDATE_EXEMPTION_URL'
      }
    },
    marineLicences: {
      apiUrl: {
        doc: 'URL for the Dynamics API to send a Marine Licence',
        format: requiredFromEnvInCdp,
        default: '',
        env: 'DYNAMICS_MARINE_LICENCE_API_URL'
      }
    },
    contactDetails: {
      clientId: {
        doc: 'The client ID.',
        format: requiredFromEnvInCdp,
        default: '',
        env: 'DYNAMICS_CLIENT_ID_CONTACT_DETAILS'
      },
      clientSecret: {
        doc: 'The client secret.',
        format: requiredFromEnvInCdp,
        default: '',
        env: 'DYNAMICS_CLIENT_SECRET_CONTACT_DETAILS'
      },
      scope: {
        doc: 'Scope Dynamics Contact details API',
        format: requiredFromEnvInCdp,
        default: '',
        env: 'DYNAMICS_SCOPE_CONTACT_DETAILS'
      },
      apiUrl: {
        doc: 'URL for the Dynamics API to get contact details',
        format: requiredFromEnvInCdp,
        default: '',
        env: 'DYNAMICS_API_CONTACT_DETAILS_URL'
      },
      baseUrl: {
        doc: 'Base URL for the Dynamics API for batch contact queries',
        format: requiredFromEnvInCdp,
        default: '',
        env: 'DYNAMICS_API_CONTACT_DETAILS_BASE_URL'
      }
    },
    tokenUrl: {
      doc: 'URL to get token for the Dynamics request',
      format: String,
      default:
        'https://login.microsoftonline.com/6f504113-6b64-43f2-ade9-242e05780007/oauth2/v2.0/token',
      env: 'DYNAMICS_TOKEN_URL'
    },
    isDynamicsEnabled: {
      doc: 'Is Dynamics integration enabled',
      format: Boolean,
      default: false,
      env: 'DYNAMICS_ENABLED'
    }
  },
  exploreMarinePlanning: {
    apiUrl: {
      doc: 'URL for the EMP API',
      format: String,
      default: '',
      env: 'EMP_API_URL'
    },
    apiKey: {
      doc: 'API key for the EMP API',
      format: String,
      default: '',
      env: 'EMP_API_KEY'
    },
    isEmpEnabled: {
      doc: 'Is EMP integration enabled',
      format: Boolean,
      default: false,
      env: 'EMP_ENABLED'
    },
    maxRetries: {
      doc: 'Maximum number of retries for failed EMP queue items',
      format: Number,
      default: 3,
      env: 'EMP_MAX_RETRIES'
    },
    retryDelayMs: {
      doc: 'Delay in milliseconds before retrying a failed EMP queue item',
      format: Number,
      default: oneMinuteInMS,
      env: 'EMP_RETRY_DELAY_MS'
    }
  },
  externalGeoAreas: {
    coastalOperationsAreas: {
      geoJsonUrl: {
        doc: 'URL for the Coastal Operations Areas GeoJSON API',
        format: String,
        default: '',
        env: 'COASTAL_OPERATIONS_AREAS_API_URL'
      },
      refreshAreas: {
        doc: 'Force application to update Coastal Operations Areas',
        format: Boolean,
        default: false,
        env: 'REFRESH_COASTAL_OPERATIONS_AREAS'
      }
    },
    marinePlanArea: {
      geoJsonUrl: {
        doc: 'URL for the Marine Plan Areas GeoJSON API',
        format: String,
        default: '',
        env: 'MARINE_PLAN_AREAS_API_URL'
      },
      refreshAreas: {
        doc: 'Force application to update the Marine Plan Areas',
        format: Boolean,
        default: false,
        env: 'REFRESH_MARINE_PLAN_AREAS'
      }
    }
  },
  notify: {
    apiKey: {
      doc: 'API key for Notify',
      format: requiredFromEnvInCdp,
      default: '#',
      env: 'NOTIFY_API_KEY'
    },
    retryIntervalSeconds: {
      doc: 'Retry interval in seconds for Notify',
      format: Number,
      default: 10,
      env: 'NOTIFY_RETRY_INTERVAL_SECONDS'
    },
    retries: {
      doc: 'Number of retries for Notify',
      format: Number,
      default: 3,
      env: 'NOTIFY_RETRIES'
    },
    exemption: {
      notifyTemplateId: {
        doc: 'Notify template ID for exemption confirmation',
        format: String,
        default: 'a9f8607a-1a1b-4c49-87c0-b260824d2e12',
        env: 'NOTIFY_TEMPLATE_ID'
      },
      notifyTemplateIdEmployee: {
        doc: 'Notify template ID for exemption confirmation (employee)',
        format: String,
        default: 'acaa23a2-a7df-4d77-be68-a37b1253d3c8',
        env: 'NOTIFY_TEMPLATE_ID_EMPLOYEE'
      },
      notifyTemplateIdAgent: {
        doc: 'Notify template ID for exemption confirmation (agent)',
        format: String,
        default: 'e7ad2882-ca12-44fa-b56d-0afbb18d9ccc',
        env: 'NOTIFY_TEMPLATE_ID_AGENT'
      }
    },
    marineLicence: {
      notifyTemplateId: {
        doc: 'Notify template ID for marine licence confirmation',
        format: String,
        default: 'ae943ee9-b334-4815-9f89-17d5e962c89c',
        env: 'NOTIFY_MARINE_LICENCE_TEMPLATE_ID'
      },
      notifyTemplateIdEmployee: {
        doc: 'Notify template ID for marine licence confirmation (employee)',
        format: String,
        default: '7da6abe5-58b3-4166-9191-653bfc36b6d7',
        env: 'NOTIFY_MARINE_LICENCE_TEMPLATE_ID_EMPLOYEE'
      },
      notifyTemplateIdAgent: {
        doc: 'Notify template ID for marine licence confirmation (agent)',
        format: String,
        default: 'c30e5fb4-70f9-46fb-9fbb-a82f45d45664',
        env: 'NOTIFY_MARINE_LICENCE_TEMPLATE_ID_AGENT'
      }
    }
  },
  policies: {
    isEnabled: {
      doc: 'Enable the marine plan policy calculation workers',
      format: Boolean,
      default: true,
      env: 'MARINE_POLICIES_ENABLED'
    },
    sqsEndpoint: {
      doc: 'SQS endpoint (LocalStack locally, AWS default in CDP)',
      format: requiredFromEnvInCdp,
      default: 'http://localhost:4566',
      env: 'SQS_ENDPOINT'
    },
    sqsQueueUrl: {
      doc: 'URL of the marine plan policies FIFO queue',
      format: requiredFromEnvInCdp,
      default:
        'http://localhost:4566/000000000000/marine_licensing_policies.fifo',
      env: 'MARINE_POLICIES_SQS_QUEUE_URL'
    },
    sqsDlqUrl: {
      doc: 'URL of the marine plan policies FIFO dead-letter queue',
      format: requiredFromEnvInCdp,
      default:
        'http://localhost:4566/000000000000/marine_licensing_policies_deadletter.fifo',
      env: 'MARINE_POLICIES_SQS_DLQ_URL'
    },
    arcgisUrl: {
      doc: 'URL of the DEFRA ArcGIS FeatureServer layer used to find applicable marine plan policies (public; same value in all environments)',
      format: String,
      default:
        'https://services.arcgis.com/JJzESW51TqeY9uat/ArcGIS/rest/services/PolicyData_MDP/FeatureServer/0',
      env: 'ARCGIS_FEATURE_SERVER_URL'
    },
    govukPoliciesUrl: {
      doc: 'URL of the GOV.UK marine-plans-explorer policies API (public; same value in all environments)',
      format: String,
      default:
        'https://environment.data.gov.uk/marine-plans-explorer/api/policies',
      env: 'GOVUK_MARINE_POLICIES_API_URL'
    },
    arcgisTimeoutMs: {
      doc: 'Per-request timeout for ArcGIS feature-server queries',
      format: Number,
      default: 90_000,
      env: 'MARINE_POLICIES_ARCGIS_TIMEOUT_MS'
    },
    wordingTimeoutMs: {
      doc: 'Per-request timeout for GOV.UK policy wording fetches',
      format: Number,
      default: 30_000,
      env: 'MARINE_POLICIES_WORDING_TIMEOUT_MS'
    },
    userAgent: {
      doc: 'User-Agent header sent on outbound policy-calculation HTTP calls',
      format: String,
      default: 'marine-licensing-backend/1.0',
      env: 'MARINE_POLICIES_USER_AGENT'
    },
    retryAfterCapMs: {
      doc: 'Maximum wait honoured from an upstream Retry-After header',
      format: Number,
      default: 600_000,
      env: 'MARINE_POLICIES_RETRY_AFTER_CAP_MS'
    },
    abandonAfterMs: {
      doc: 'Age after which a policy-calculation job that has not succeeded is marked abandoned',
      format: Number,
      default: 36 * 60 * 60 * 1000,
      env: 'MARINE_POLICIES_ABANDON_AFTER_MS'
    }
  },
  iat: {
    inFlightTtlMs: {
      doc: 'TTL in milliseconds for in-flight iat-contexts documents. Mongo TTL index purges abandoned IAT journeys after this period.',
      format: Number,
      default: 24 * 60 * 60 * 1000,
      env: 'IAT_IN_FLIGHT_TTL_MS'
    }
  }
})

config.validate({ allowed: 'strict' })

export { config }
