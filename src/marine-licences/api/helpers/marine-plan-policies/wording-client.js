import { config } from '../../../../config.js'
import { collectionMarinePlanPolicyWording } from '../../../../shared/common/constants/db-collections.js'
import { MARINE_PLAN_POLICY_EVENT_ACTION } from '../../../constants/marine-licence.js'
import { timedJsonFetch } from './policy-http.js'

const CONTENT_FIELDS = [
  'policy',
  'policyAim',
  'whatIsIt',
  'whyIsItImportant',
  'howWillThisBeImplemented'
]

const toCacheDocument = (entry, fetchedAt) =>
  CONTENT_FIELDS.reduce(
    (doc, field) => {
      doc[field] = entry[field] ?? null
      return doc
    },
    { fetchedAt }
  )

const toContent = (cached) =>
  CONTENT_FIELDS.reduce((content, field) => {
    content[field] = cached[field] ?? null
    return content
  }, {})

const refreshPolicyDataset = async (collection, logger) => {
  const { govukPoliciesUrl, wordingTimeoutMs } =
    config.get('marinePlanPolicies')

  // The API has no per-code route — it returns every policy in one array,
  // so a single fetch refreshes the whole 24h cache for all codes.
  const policies = await timedJsonFetch({
    url: govukPoliciesUrl,
    timeoutMs: wordingTimeoutMs,
    eventAction: MARINE_PLAN_POLICY_EVENT_ACTION.WORDING_FETCH,
    upstreamName: 'GOV.UK marine plan policies fetch',
    logger
  })

  if (!Array.isArray(policies) || policies.length === 0) {
    throw new Error('GOV.UK policies API returned no policies')
  }

  const fetchedAt = new Date()
  await collection.bulkWrite(
    policies
      .filter((entry) => entry.code)
      .map((entry) => ({
        updateOne: {
          filter: { _id: entry.code },
          update: { $set: toCacheDocument(entry, fetchedAt) },
          upsert: true
        }
      }))
  )
}

export const getPolicyContent = async ({ policyCode, db, logger }) => {
  const collection = db.collection(collectionMarinePlanPolicyWording)

  const cached = await collection.findOne({ _id: policyCode })
  if (cached) {
    return toContent(cached)
  }

  await refreshPolicyDataset(collection, logger)

  const refreshed = await collection.findOne({ _id: policyCode })
  if (!refreshed) {
    throw new Error(
      `Policy ${policyCode} not present in the GOV.UK policies dataset`
    )
  }
  return toContent(refreshed)
}
