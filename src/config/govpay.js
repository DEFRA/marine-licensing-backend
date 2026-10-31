export const govPaySchema = {
  isEnabled: {
    doc: 'Enable the GOV.UK Pay payment routes and reconciliation',
    format: Boolean,
    default: false,
    env: 'GOVPAY_ENABLED'
  },
  apiUrl: {
    doc: 'GOV.UK Pay API base URL, without /v1. The api-stub serves it at /govpay locally.',
    format: String,
    default: 'http://localhost:3002/govpay',
    env: 'GOVPAY_API_URL'
  },
  apiKey: {
    doc: 'GOV.UK Pay API key. Any non-empty value works against the api-stub.',
    format: String,
    nullable: true,
    sensitive: true,
    default: null,
    env: 'GOVPAY_API_KEY'
  },
  returnBaseUrl: {
    doc: 'Public frontend base URL that GOV.UK Pay sends the user back to',
    format: String,
    default: 'http://localhost:3000',
    env: 'GOVPAY_RETURN_BASE_URL'
  },
  amountPence: {
    doc: 'Marine licence application fee, in pence',
    format: 'nat',
    default: 5000,
    env: 'GOVPAY_AMOUNT_PENCE'
  },
  timeoutMs: {
    doc: 'Timeout for GOV.UK Pay API calls, in milliseconds',
    format: 'nat',
    default: 10000,
    env: 'GOVPAY_TIMEOUT_MS'
  },
  reconcileAfterMinutes: {
    doc: 'Age after which an unfinished payment is resolved by the reconciliation job. GOV.UK Pay expires payments after 90 minutes.',
    format: 'nat',
    default: 90,
    env: 'GOVPAY_RECONCILE_AFTER_MINUTES'
  }
}
