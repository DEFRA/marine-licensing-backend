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

export const getPoliciesContent = async ({ policies, db, logger }) => {
  if (policies.length === 0) {
    return []
  }

  const collection = db.collection(collectionMarinePlanPolicyWording)
  const codes = policies.map((p) => p.policyCode)

  const cachedPlanPolicyWording = await collection
    .find({ _id: { $in: codes } })
    .toArray()
  const cachedPlanPolicyWordingAsMap = new Map(
    cachedPlanPolicyWording.map((doc) => [doc._id, doc])
  )

  const missingCodes = codes.filter(
    (code) => !cachedPlanPolicyWordingAsMap.has(code)
  )

  if (missingCodes.length > 0) {
    await refreshPolicyDataset(collection, logger)

    const refreshedDocs = await collection
      .find({ _id: { $in: missingCodes } })
      .toArray()
    refreshedDocs.forEach((doc) =>
      cachedPlanPolicyWordingAsMap.set(doc._id, doc)
    )

    const stillMissing = missingCodes.filter(
      (code) => !cachedPlanPolicyWordingAsMap.has(code)
    )
    if (stillMissing.length > 0) {
      const fetchedAt = new Date()
      await collection.bulkWrite(
        stillMissing.map((code) => ({
          updateOne: {
            filter: { _id: code },
            update: { $set: { notFound: true, fetchedAt } },
            upsert: true
          }
        }))
      )
      stillMissing.forEach((code) => {
        logger.warn(
          {
            event: {
              action: MARINE_PLAN_POLICY_EVENT_ACTION.WORDING_FETCH,
              outcome: 'failure'
            }
          },
          `Policy ${code} not present in the GOV.UK policies dataset; substituting empty wording`
        )
        cachedPlanPolicyWordingAsMap.set(code, { _id: code, notFound: true })
      })
    }
  }

  return policies.map((policy) => {
    const doc = cachedPlanPolicyWordingAsMap.get(policy.policyCode)
    if (!doc || doc.notFound) {
      if (doc?.notFound) {
        logger.info(
          {
            event: {
              action: MARINE_PLAN_POLICY_EVENT_ACTION.WORDING_FETCH,
              outcome: 'success'
            }
          },
          `Policy ${policy.policyCode} served from cache of not found policy codes (absent from GOV.UK dataset)`
        )
      }
      return { ...policy, ...toEmptyContent() }
    }
    return { ...policy, ...toContent(doc) }
  })
}
