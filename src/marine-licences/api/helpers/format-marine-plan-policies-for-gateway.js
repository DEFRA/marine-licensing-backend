export const formatMarinePlanPoliciesForGateway = (
  marinePlanPolicies = [],
  marinePlanPolicyResponses = {}
) =>
  marinePlanPolicies.map((policy) => ({
    policyCode: policy.policyCode ?? null,
    policyInformation: policy.policy ?? null,
    applicantAnswer: marinePlanPolicyResponses[policy.policyCode] ?? null
  }))
