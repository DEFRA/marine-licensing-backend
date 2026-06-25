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

const toEmptyContent = () =>
  CONTENT_FIELDS.reduce((content, field) => {
    content[field] = ''
    return content
  }, {})

const refreshPolicyDataset = async (collection, logger) => {
  const { govukPoliciesUrl, wordingTimeoutMs } =
    config.get('marinePlanPolicies')

  // The API returns all policies in one response, so one fetch refreshes the full cache.
  const policies = await timedJsonFetch({
    url: govukPoliciesUrl,
    timeoutMs: wordingTimeoutMs,
    eventAction: MARINE_PLAN_POLICY_EVENT_ACTION.WORDING_FETCH,
    upstreamName: 'marine plan policy wording',
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
    if (cached.notFound) {
      logger.info(
        {
          event: {
            action: MARINE_PLAN_POLICY_EVENT_ACTION.WORDING_FETCH,
            outcome: 'success'
          }
        },
        `Policy ${policyCode} served from sentinel cache (absent from GOV.UK dataset)`
      )
      return toEmptyContent()
    }
    return toContent(cached)
  }

  await refreshPolicyDataset(collection, logger)

  const refreshed = await collection.findOne({ _id: policyCode })
  if (!refreshed) {
    logger.warn(
      {
        event: {
          action: MARINE_PLAN_POLICY_EVENT_ACTION.WORDING_FETCH,
          outcome: 'failure'
        }
      },
      `Policy ${policyCode} not present in the GOV.UK policies dataset; substituting empty wording`
    )
    await collection.updateOne(
      { _id: policyCode },
      { $set: { notFound: true, fetchedAt: new Date() } },
      { upsert: true }
    )
    return toEmptyContent()
  }
  return toContent(refreshed)
}
