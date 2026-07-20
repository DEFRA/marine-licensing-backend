import { createLogger } from '../src/shared/common/helpers/logging/logger.js'
import {
  collectionMarineLicences,
  collectionMarinePlanPolicyWordingSnapshots,
  MARINE_PLAN_POLICY_CONTENT_FIELDS,
  pinWordingSnapshots
} from './helpers/wording-snapshots.js'

const logger = createLogger()
const logSystem =
  'Migration:20260708000000-marine-plan-policy-wording-snapshots'

// Elements are detected per policy, so a partially migrated licence (or a
// re-run after a crash) is handled: pointers are left alone, embedded wording
// is pinned. The snapshot store is append-only ($setOnInsert), so re-pinning
// the same wording is a no-op and the migration is idempotent.
const hasEmbeddedWording = { wordingRef: { $exists: false } }

export const up = async (db) => {
  const licences = db.collection(collectionMarineLicences)
  const migrationTime = new Date()
  let migratedCount = 0

  const cursor = licences.find({
    marinePlanPolicies: { $elemMatch: hasEmbeddedWording }
  })

  for await (const licence of cursor) {
    const embedded = licence.marinePlanPolicies.filter((p) => !p.wordingRef)
    const pinned = await pinWordingSnapshots({
      db,
      policies: embedded,
      now: licence.updatedAt ?? migrationTime
    })

    const pinnedByKey = new Map(
      pinned.map((p) => [`${p.policyCode}::${p.sector}`, p])
    )
    const migrated = licence.marinePlanPolicies.map((p) =>
      p.wordingRef ? p : pinnedByKey.get(`${p.policyCode}::${p.sector}`)
    )

    await licences.updateOne(
      { _id: licence._id },
      { $set: { marinePlanPolicies: migrated } }
    )
    migratedCount++
  }

  logger.info(
    `${logSystem}: replaced embedded policy wording with snapshot pointers on ${migratedCount} licence(s)`
  )
}

// Rehydrates embedded wording from the snapshot store. The snapshot collection
// is deliberately NOT dropped: it is the immutable legal record of the wording
// each licence was given, and licences enriched after `up` ran have no other
// copy of their wording.
export const down = async (db) => {
  const licences = db.collection(collectionMarineLicences)
  const snapshots = db.collection(collectionMarinePlanPolicyWordingSnapshots)
  let rehydratedCount = 0

  const cursor = licences.find({
    marinePlanPolicies: { $elemMatch: { wordingRef: { $exists: true } } }
  })

  for await (const licence of cursor) {
    const refs = licence.marinePlanPolicies
      .filter((p) => p.wordingRef)
      .map((p) => p.wordingRef)
    const rows = await snapshots.find({ _id: { $in: refs } }).toArray()
    const byRef = new Map(rows.map((r) => [r._id, r]))

    const rehydrated = licence.marinePlanPolicies.map((p) => {
      if (!p.wordingRef) {
        return p
      }
      const snapshot = byRef.get(p.wordingRef)
      return MARINE_PLAN_POLICY_CONTENT_FIELDS.reduce(
        (policy, field) => {
          policy[field] = snapshot ? snapshot[field] : ''
          return policy
        },
        { policyCode: p.policyCode, sector: p.sector }
      )
    })

    await licences.updateOne(
      { _id: licence._id },
      { $set: { marinePlanPolicies: rehydrated } }
    )
    rehydratedCount++
  }

  logger.info(
    `${logSystem}: rehydrated embedded policy wording on ${rehydratedCount} licence(s)`
  )
}
