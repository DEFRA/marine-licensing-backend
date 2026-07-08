import { createHash } from 'node:crypto'
import { collectionMarinePlanPolicyWordingSnapshots } from '../../../../shared/common/constants/db-collections.js'
import { MARINE_PLAN_POLICY_CONTENT_FIELDS as CONTENT_FIELDS } from '../../../constants/marine-licence.js'

const WORDING_REF_HASH_LENGTH = 12
const DUPLICATE_KEY_ERROR_CODE = 11000

// Fixed field order, values verbatim. JSON.stringify keeps null ('null') distinct
// from empty wording ('""') so the two hash to different snapshots.
export const canonicaliseWording = (wording) =>
  CONTENT_FIELDS.map((field) => JSON.stringify(wording[field] ?? null)).join(
    '|'
  )

export const computeWordingRef = (policyCode, wording) => {
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
  CONTENT_FIELDS.reduce((fields, field) => {
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
