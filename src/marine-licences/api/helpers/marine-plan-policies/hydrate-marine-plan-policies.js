import { collectionMarinePlanPolicyWordingSnapshots } from '../../../../shared/common/constants/db-collections.js'
import { MARINE_PLAN_POLICY_CONTENT_FIELDS } from '../../../constants/marine-licence.js'

// The licence stores { policyCode, sector, wordingRef } pointers; rebuild the
// full policy objects from the immutable snapshot store so the API response
// shape is unchanged. Entries without a wordingRef (legacy embedded wording)
// pass through untouched.
export const hydrateMarinePlanPolicies = async (db, marineLicence) => {
  const policies = marineLicence.marinePlanPolicies ?? []
  const refs = policies.filter((p) => p.wordingRef).map((p) => p.wordingRef)
  if (refs.length === 0) {
    return marineLicence
  }

  const snapshots = await db
    .collection(collectionMarinePlanPolicyWordingSnapshots)
    .find({ _id: { $in: refs } })
    .project(
      Object.fromEntries(
        MARINE_PLAN_POLICY_CONTENT_FIELDS.map((field) => [field, 1])
      )
    )
    .toArray()
  const snapshotsByRef = new Map(snapshots.map((s) => [s._id, s]))

  marineLicence.marinePlanPolicies = policies.map((p) => {
    if (!p.wordingRef) {
      return p
    }
    const snapshot = snapshotsByRef.get(p.wordingRef)
    return MARINE_PLAN_POLICY_CONTENT_FIELDS.reduce(
      (policy, field) => {
        // A missing snapshot must never break the read; degrade to empty wording
        policy[field] = snapshot ? snapshot[field] : ''
        return policy
      },
      { policyCode: p.policyCode, sector: p.sector }
    )
  })
  return marineLicence
}
