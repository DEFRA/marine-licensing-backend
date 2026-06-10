import { computePolicyJobId } from './policy-job-hash.js'

/**
 * Returns the $set fields that discard previously-computed marine plan
 * policies when a site edit genuinely changes the geometry, or an empty
 * object when it doesn't. The applicant's written policyResponses are always
 * preserved — they are deliberately never part of the reset. Non-geometry
 * edits (site names, activity details) leave the policy state untouched so
 * the applicant isn't asked to recalculate for nothing.
 */
export const buildPolicyResetFields = (id, existing, newSiteDetails) => {
  if (!existing?.policyJobId) {
    return {}
  }
  const newPolicyJobId = computePolicyJobId(id, newSiteDetails)
  if (existing.policyJobId === newPolicyJobId) {
    return {}
  }
  return {
    policyJob: null,
    policyJobId: null,
    policyJobQueuedAt: null,
    marinePlanPolicies: []
  }
}
