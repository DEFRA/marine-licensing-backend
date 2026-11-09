/**
 * Environments where the journey-test data cleanup endpoint is registered.
 * Must stay limited to non-production CDP environments.
 */
export const CLEANUP_ENABLED_ENVIRONMENTS = ['dev', 'test']

/**
 * Government Gateway ID for the shared Defra ID account used by journey tests
 * on the CDP test environment: 94 84 91 50 68 51 (948491506851).
 *
 * Exemptions and marine licences store the Dynamics contactId from the Defra ID
 * JWT, not the Gateway ID. Look the contactId up from MongoDB, e.g.:
 *
 *   db.exemptions.aggregate([
 *     { $group: { _id: '$contactId', count: { $sum: 1 },
 *                 org: { $first: '$organisation.name' } } },
 *     { $sort: { count: -1 } }
 *   ])
 *
 * Override at runtime with JOURNEY_TEST_CONTACT_ID if the Dynamics GUID changes.
 */
export const JOURNEY_TEST_GOVERNMENT_GATEWAY_ID = '948491506851'

/**
 * Dynamics contactId for {@link JOURNEY_TEST_GOVERNMENT_GATEWAY_ID}.
 * Empty until looked up from test MongoDB; set via env or update this default.
 */
export const JOURNEY_TEST_CONTACT_ID = ''
