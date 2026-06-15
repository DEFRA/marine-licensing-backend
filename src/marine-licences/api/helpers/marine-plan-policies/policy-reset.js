import { computePolicyJobId } from './policy-job-hash.js'

// marinePlanPolicyResponses are deliberately never reset — only policy job state is discarded on geometry change.
export const buildPolicyResetFields = (id, existing, newSiteDetails) => {
  if (!existing?.marinePlanPolicyJobId) {
    return {}
  }
  const newPolicyJobId = computePolicyJobId(id, newSiteDetails)
  if (existing.marinePlanPolicyJobId === newPolicyJobId) {
    return {}
  }
  return {
    marinePlanPolicyJob: null,
    marinePlanPolicyJobId: null,
    marinePlanPolicyJobQueuedAt: null,
    marinePlanPolicies: []
  }
}
