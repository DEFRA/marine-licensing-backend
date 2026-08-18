/**
 * The area→policy-code mapping is a derivation convention, not a
 * lookup table. 'NE_i' / 'NE_o' both derive 'NE-'; a future conforming region
 * (e.g. 'W_i') is covered automatically. The trailing hyphen plus an ANCHORED
 * starts-with match is what prevents false positives: 'S-' cannot match
 * 'SE-…'/'SW-…' and 'E-' cannot match 'NE-…'/'SE-…'.
 */
export const derivePolicyCodePrefix = (regionref) =>
  `${String(regionref).split('_')[0]}-`

export const filterPoliciesByPrefixes = (policies, prefixes) => {
  const matches = (prefix) => (policy) => policy.policyCode.startsWith(prefix)
  return {
    policies: policies.filter((policy) =>
      prefixes.some((prefix) => matches(prefix)(policy))
    ),
    // Residual guard: a prefix matching zero non-spatial codes is
    // the detector for the regionref/policy-code naming convention drifting.
    unmatchedPrefixes: prefixes.filter(
      (prefix) => !policies.some(matches(prefix))
    )
  }
}
