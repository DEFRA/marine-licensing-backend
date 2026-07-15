import { createHash } from 'node:crypto'

// Frozen copy of src/marine-licences/api/helpers/marine-plan-policies/wording-snapshots.js
// (and the constants it relies on) as of migration 20260708000000. Migrations must not
// import evolving src modules: they are immutable snapshots, and a src import is also
// loaded natively by migrate-mongo outside Vitest's instrumentation, which corrupts the
// module's merged V8 coverage in integration-test runs.

export const collectionMarineLicences = 'marine-licences'
export const collectionMarinePlanPolicyWordingSnapshots =
  'marine-plan-policy-wording-snapshots'

export const MARINE_PLAN_POLICY_CONTENT_FIELDS = [
  'policy',
  'policyAim',
  'whatIsIt',
  'whyIsItImportant',
  'howWillThisBeImplemented'
]

const WORDING_REF_HASH_LENGTH = 12
const DUPLICATE_KEY_ERROR_CODE = 11000

// Fixed field order, values verbatim. JSON.stringify keeps null ('null') distinct
// from empty wording ('""') so the two hash to different snapshots.
const canonicaliseWording = (wording) =>
  MARINE_PLAN_POLICY_CONTENT_FIELDS.map((field) =>
    JSON.stringify(wording[field] ?? null)
  ).join('|')

const computeWordingRef = (policyCode, wording) => {
  const contentHash = createHash('sha256')
    .update(canonicaliseWording(wording))
    .digest('hex')
  return {
    contentHash,
    wordingRef: `${policyCode}@${contentHash.slice(0, WORDING_REF_HASH_LENGTH)}`
  }
}

// Concurrent workers can race the same upsert and still hit a duplicate-key
// error; the row already holds identical content, so that is a success.
const isOnlyDuplicateKeyErrors = (error) =>
  error.code === DUPLICATE_KEY_ERROR_CODE ||
  (error.writeErrors?.length > 0 &&
    error.writeErrors.every((e) => e.code === DUPLICATE_KEY_ERROR_CODE))

const toWordingFields = (wording) =>
  MARINE_PLAN_POLICY_CONTENT_FIELDS.reduce((fields, field) => {
    fields[field] = wording[field] ?? null
    return fields
  }, {})

// Captures each distinct wording once (write-once via $setOnInsert — an existing
// snapshot is never rewritten, so a wordingRef always resolves to the exact
// wording the licence was given) and returns the pointers to store on the licence.
export const pinWordingSnapshots = async ({ db, policies, now }) => {
  if (policies.length === 0) {
    return []
  }

  const pinned = []
  const ops = policies.map(({ policyCode, sector, ...wording }) => {
    const { contentHash, wordingRef } = computeWordingRef(policyCode, wording)
    pinned.push({ policyCode, sector, wordingRef })
    return {
      updateOne: {
        filter: { _id: wordingRef },
        update: {
          $setOnInsert: {
            policyCode,
            contentHash,
            capturedAt: now,
            ...toWordingFields(wording)
          }
        },
        upsert: true
      }
    }
  })

  try {
    await db
      .collection(collectionMarinePlanPolicyWordingSnapshots)
      .bulkWrite(ops, { ordered: false })
  } catch (error) {
    if (!isOnlyDuplicateKeyErrors(error)) {
      throw error
    }
  }

  return pinned
}
