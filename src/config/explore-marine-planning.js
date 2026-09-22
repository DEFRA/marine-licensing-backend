const oneMinuteInMS = 60 * 1000

/** Default minutes before a stuck `in_progress` EMP queue item may be reclaimed. */
const empQueueClaimStaleDefaultMinutes = 30

export const exploreMarinePlanningSchema = {
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
  },
  claimStaleMs: {
    doc: 'After this many milliseconds in in_progress (without success/failure), a queue item may be claimed by another worker. Set higher than the longest expected EMP call to avoid duplicate sends.',
    format: Number,
    default: empQueueClaimStaleDefaultMinutes * oneMinuteInMS,
    env: 'EMP_CLAIM_STALE_MS'
  }
}
