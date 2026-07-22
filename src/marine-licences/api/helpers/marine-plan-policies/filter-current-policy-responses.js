// Scopes stored marinePlanPolicyResponses (a superset that survives site/policy
// re-queries by design) down to whatever policies are currently applicable, so
// stale answers from a previous policy set never inflate progress.
export const filterCurrentPolicyResponses = (
  marinePlanPolicies = [],
  marinePlanPolicyResponses = {}
) => {
  const currentCodes = new Set(marinePlanPolicies.map((p) => p.policyCode))

  const responses = Object.fromEntries(
    Object.entries(marinePlanPolicyResponses).filter(([code]) =>
      currentCodes.has(code)
    )
  )

  const count = Object.values(responses).filter((value) => value !== '').length

  return { responses, count }
}
