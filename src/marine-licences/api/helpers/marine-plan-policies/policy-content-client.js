import { config } from '../../../../config.js'
import { collectionMarinePlanPolicyWording } from '../../../../shared/common/constants/db-collections.js'
import {
  MARINE_PLAN_POLICY_EVENT_ACTION,
  MARINE_PLAN_POLICY_CONTENT_FIELDS as CONTENT_FIELDS
} from '../../../constants/marine-licence.js'
import { timedJsonFetch } from './policy-http.js'
import { sanitisePolicyWording } from './sanitise-policy-wording.js'

const normalisePolicyCode = (code) => code.replace(/\s/g, '')

const isValidCode = (code) => typeof code === 'string' && code.trim() !== ''

const logFieldRejected = ({ logger, action, code, field, reason }) =>
  logger.warn(
    {
      event: {
        action,
        outcome: 'failure',
        reference: `${code}/${field}`,
        reason
      }
    },
    `Policy ${code} field ${field} rejected at ingest; stored as null`
  )

const sanitiseWordingField = ({
  value,
  code,
  field,
  maxFieldBytes,
  logger
}) => {
  if (value == null) {
    return null
  }
  if (typeof value !== 'string') {
    logFieldRejected({
      logger,
      action: MARINE_PLAN_POLICY_EVENT_ACTION.WORDING_FIELD_INVALID,
      code,
      field,
      reason:
        'Non-string wording value received from the GOV.UK policies API; raise a data-quality issue with the marine plans explorer team'
    })
    return null
  }
  const sanitised = sanitisePolicyWording(value)
  if (Buffer.byteLength(sanitised, 'utf8') > maxFieldBytes) {
    logFieldRejected({
      logger,
      action: MARINE_PLAN_POLICY_EVENT_ACTION.WORDING_FIELD_TOO_LARGE,
      code,
      field,
      reason: `Sanitised wording exceeds the ${maxFieldBytes} byte cap; refusing to store rather than truncate`
    })
    return null
  }
  return sanitised
}

const toCacheDocument = ({ entry, fetchedAt, maxFieldBytes, logger }) =>
  CONTENT_FIELDS.reduce(
    (doc, field) => {
      doc[field] = sanitiseWordingField({
        value: entry[field],
        code: entry.code,
        field,
        maxFieldBytes,
        logger
      })
      return doc
    },
    { fetchedAt }
  )

const keepValidEntries = (policies, logger) =>
  policies.filter((entry, index) => {
    if (isValidCode(entry?.code)) {
      return true
    }
    logger.warn(
      {
        event: {
          action: MARINE_PLAN_POLICY_EVENT_ACTION.WORDING_ENTRY_SKIPPED,
          outcome: 'failure',
          reference: `entry-index/${index}`,
          reason:
            'Entry in the GOV.UK policies API response has a missing or non-string code; raise a data-quality issue with the marine plans explorer team'
        }
      },
      `Skipped GOV.UK policies API entry at index ${index}: missing or non-string code`
    )
    return false
  })

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
  const {
    govukPoliciesUrl,
    wordingTimeoutMs,
    wordingMaxResponseBytes,
    wordingMaxFieldBytes
  } = config.get('marinePlanPolicies')

  // The API returns all policies in one response, so one fetch refreshes the full cache.
  const policies = await timedJsonFetch({
    url: govukPoliciesUrl,
    timeoutMs: wordingTimeoutMs,
    maxBytes: wordingMaxResponseBytes,
    eventAction: MARINE_PLAN_POLICY_EVENT_ACTION.WORDING_FETCH,
    upstreamName: 'marine plan policy wording',
    logger
  })

  if (!Array.isArray(policies) || policies.length === 0) {
    throw new Error('GOV.UK policies API returned no policies')
  }

  const validPolicies = keepValidEntries(policies, logger)
  if (validPolicies.length === 0) {
    throw new Error('GOV.UK policies API returned no valid policies')
  }

  const fetchedAt = new Date()
  await collection.bulkWrite(
    validPolicies.map((entry) => ({
      updateOne: {
        filter: { _id: normalisePolicyCode(entry.code) },
        update: {
          $set: toCacheDocument({
            entry,
            fetchedAt,
            maxFieldBytes: wordingMaxFieldBytes,
            logger
          })
        },
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
