import { requiredFromEnvInCdp } from '../shared/common/helpers/convict/required-from-env-in-cdp.js'

const oneMinuteInMS = 60 * 1000
const dynamicsQueueClaimStaleDefaultMinutes = 30

export const dynamicsSchema = {
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
}
