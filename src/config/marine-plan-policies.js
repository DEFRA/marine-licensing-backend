const oneHundredKilobytesInBytes = 102_400
const thirtyMegabytesInBytes = 30_000_000

export const marinePlanPoliciesSchema = {
  isEnabled: {
    doc: 'Enable the marine plan policy calculation workers',
    format: Boolean,
    default: true,
    env: 'MARINE_PLAN_POLICIES_ENABLED'
  },
  sqsMaxReceiveCount: {
    doc: 'Number of delivery attempts before a policy job message is dead-lettered; must match the queue RedrivePolicy',
    format: Number,
    default: 3,
    env: 'MARINE_PLAN_POLICIES_SQS_MAX_RECEIVE_COUNT'
  },
  sqsQueueName: {
    doc: 'Name of the marine plan policies SQS queue',
    format: String,
    default: 'marine_licensing_policies',
    env: 'MARINE_PLAN_POLICIES_SQS_QUEUE_NAME'
  },
  sqsDlqName: {
    doc: 'Name of the marine plan policies dead-letter queue',
    format: String,
    default: 'marine_licensing_policies-deadletter',
    env: 'MARINE_PLAN_POLICIES_SQS_DLQ_NAME'
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
      'https://environment.data.gov.uk/explore-marine-plans/api/policies',
    env: 'GOVUK_MARINE_POLICIES_API_URL'
  },
  arcgisTimeoutMs: {
    doc: 'Per-request timeout for ArcGIS feature-server queries. Must satisfy: arcgisTimeoutMs + wordingTimeoutMs << SQS VisibilityTimeout (60 s CDP default)',
    format: Number,
    default: 20_000,
    env: 'MARINE_PLAN_POLICIES_ARCGIS_TIMEOUT_MS'
  },
  wordingTimeoutMs: {
    doc: 'Per-request timeout for GOV.UK policy wording fetches. Must satisfy: arcgisTimeoutMs + wordingTimeoutMs << SQS VisibilityTimeout (60 s CDP default)',
    format: Number,
    default: 10_000,
    env: 'MARINE_PLAN_POLICIES_WORDING_TIMEOUT_MS'
  },
  wordingMaxFieldBytes: {
    doc: 'Maximum size in bytes of a single sanitised policy wording field; larger fields are stored as null and logged; must be positive',
    format: Number,
    default: oneHundredKilobytesInBytes,
    env: 'MARINE_PLAN_POLICIES_WORDING_MAX_FIELD_BYTES'
  },
  wordingMaxResponseBytes: {
    doc: 'Maximum allowed response size in bytes when fetching the GOV.UK policies dataset (current live payload is ~6MB); 0 disables the cap',
    format: Number,
    default: thirtyMegabytesInBytes,
    env: 'MARINE_PLAN_POLICIES_WORDING_MAX_RESPONSE_BYTES'
  },
  userAgent: {
    doc: 'User-Agent header sent with requests to the ArcGIS and GOV.UK policy APIs',
    format: String,
    default: 'Defra / MMO / Get permission for marine work',
    env: 'MARINE_PLAN_POLICIES_USER_AGENT'
  },
  nearestAreaMaxVertexSpacingMetres: {
    doc: 'Nearest-area fallback: site boundary edges are densified so no two consecutive vertices are further apart than this. Sets the BEST achievable edge-distance error (half this value) — nearestAreaMaxVerticesPerSite can make the effective spacing coarser',
    format: Number,
    default: 500,
    env: 'MARINE_PLAN_POLICIES_NEAREST_AREA_MAX_VERTEX_SPACING_METRES'
  },
  nearestAreaMaxVerticesPerSite: {
    doc: 'Nearest-area fallback: cap on vertices queried per site after densification (downsampled evenly above this). A LATENCY budget, not a precision one — every vertex is one $geoNear, measured at ~6.6ms for a site far from any area, so this holds a single-site query near 1.5s',
    format: Number,
    default: 226,
    env: 'MARINE_PLAN_POLICIES_NEAREST_AREA_MAX_VERTICES_PER_SITE'
  }
}
