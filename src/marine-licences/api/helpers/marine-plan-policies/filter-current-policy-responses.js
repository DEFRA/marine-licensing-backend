// Scopes stored marinePlanPolicyResponses (a superset that survives site/policy
// re-queries by design) down to whatever policies are currently applicable, so
// stale answers from a previous policy set never inflate progress.
const normaliseResponse = (value) =>
  typeof value === 'string'
    ? { response: value, requiresDocumentation: false }
    : value

export const filterCurrentPolicyResponses = (
  marinePlanPolicies = [],
  marinePlanPolicyResponses = {}
) => {
  const currentCodes = new Set(marinePlanPolicies.map((p) => p.policyCode))

  const responses = Object.fromEntries(
    Object.entries(marinePlanPolicyResponses)
      .filter(([code]) => currentCodes.has(code))
      .map(([code, value]) => [code, normaliseResponse(value)])
  )

  const count = Object.values(responses).filter(
    ({ response }) => response !== ''
  ).length

  return { responses, count }
}
