import { requiredFromEnvInCdp } from '../shared/common/helpers/convict/required-from-env-in-cdp.js'

const oneHourInMs = 60 * 60 * 1000

/** Default hours before a policy-calculation job that has not succeeded is marked abandoned. */
const policyJobAbandonAfterDefaultHours = 36

// Convict schema fragment for the marine plan policy calculation workers,
// spread into the main schema in src/config.js.
export const policiesSchema = {
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
    default: policyJobAbandonAfterDefaultHours * oneHourInMs,
    env: 'MARINE_POLICIES_ABANDON_AFTER_MS'
  }
}
