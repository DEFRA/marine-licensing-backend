import { ObjectId } from 'mongodb'
import { config } from '../../../../config.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../../shared/common/helpers/logging/logger.js'
import {
  MARINE_PLAN_POLICY_JOB_STATUS,
  MARINE_PLAN_POLICY_EVENT_ACTION
} from '../../../constants/marine-licence.js'
import { queryArcGISPolicies } from './arcgis-client.js'
import { getPolicyContent } from './wording-client.js'
import { deletePolicyJob, extendVisibility } from './sqs-client.js'
import { RetryAfterError } from './policy-http.js'

const millisecondsPerSecond = 1000

const parseMessageBody = (message, logger) => {
  try {
    const { licenceId, policyJobId, queuedAt } = JSON.parse(message.Body)
    if (!licenceId || !policyJobId) {
      throw new Error('licenceId and policyJobId are required')
    }
    return { licenceId, policyJobId, queuedAt }
  } catch (error) {
    logger.error(
      structureErrorForECS(error),
      'Discarding malformed policy job message'
    )
    return null
  }
}

const fetchPolicies = async ({ siteDetails, db, logger }) => {
  const policies = await queryArcGISPolicies({ siteDetails, logger })
  const marinePlanPolicies = []
  for (const policy of policies) {
    const content = await getPolicyContent({
      policyCode: policy.policyCode,
      db,
      logger
    })
    marinePlanPolicies.push({ ...policy, ...content })
  }
  return marinePlanPolicies
}

// Conditional on marinePlanPolicyJobId so a site edit mid-flight is never overwritten
const setJobStatus = ({ collection, _id, policyJobId }, status, extra = {}) =>
  collection.updateOne(
    { _id, marinePlanPolicyJobId: policyJobId },
    { $set: { marinePlanPolicyJob: status, ...extra } }
  )

const logStaleJob = ({ logger }, detail) =>
  logger.info(
    {
      event: {
        action: MARINE_PLAN_POLICY_EVENT_ACTION.JOB_STALE,
        outcome: 'success'
      }
    },
    detail
  )

const computeAndStorePolicies = async (job, licence, db) => {
  const { licenceId, logger } = job
  const marinePlanPolicies = await fetchPolicies({
    siteDetails: licence.siteDetails,
    db,
    logger
  })

  const result = await setJobStatus(job, MARINE_PLAN_POLICY_JOB_STATUS.READY, {
    marinePlanPolicies
  })
  if (result.matchedCount > 0) {
    logger.info(
      {
        event: {
          action: MARINE_PLAN_POLICY_EVENT_ACTION.JOB_COMPLETE,
          outcome: 'success'
        }
      },
      `Policy job complete for licence ${licenceId}: ${marinePlanPolicies.length} applicable policies`
    )
  } else {
    logStaleJob(
      job,
      `Discarding policy job result computed for stale sites on licence ${licenceId}`
    )
  }
}

// Status deliberately stays 'computing' between attempts so the front end
// keeps showing the calculating view; 'failed' is terminal and only set when
// the message dead-letters after the queue's retry budget is spent.
const handleJobFailure = async (job, error, message, retryAfterCapMs) => {
  job.logger.error(
    structureErrorForECS(error),
    `Policy calculation failed for licence ${job.licenceId}; the queue will retry`
  )
  if (error instanceof RetryAfterError && error.retryAfterSeconds) {
    const cappedSeconds = Math.min(
      error.retryAfterSeconds,
      Math.round(retryAfterCapMs / millisecondsPerSecond)
    )
    await extendVisibility(message.ReceiptHandle, cappedSeconds)
  }
  // message deliberately not deleted — SQS redelivers after the visibility timeout
}

/**
 * Processes one policy-calculation job from the main queue.
 *
 * The message is deleted on success and when it is stale (the licence's
 * policyJobId no longer matches, i.e. sites were edited after it was queued).
 * On transient failure the message is left on the queue so SQS redelivers it
 * after the visibility timeout. The retry budget is owned by the queue's
 * redrive policy (maxReceiveCount: 5): once spent, the message dead-letters
 * and the DLQ worker marks the job failed so the user can trigger a fresh one.
 */
export const processPolicyJob = async (server, message) => {
  const { db, logger } = server
  const { sqsQueueUrl, retryAfterCapMs } = config.get('marinePlanPolicies')

  const body = parseMessageBody(message, logger)
  if (!body) {
    await deletePolicyJob(sqsQueueUrl, message.ReceiptHandle)
    return
  }
  const { licenceId, policyJobId } = body
  const job = {
    collection: db.collection(collectionMarineLicences),
    _id: ObjectId.createFromHexString(licenceId),
    licenceId,
    policyJobId,
    logger
  }

  const licence = await job.collection.findOne({ _id: job._id })
  if (!licence || licence.marinePlanPolicyJobId !== policyJobId) {
    logStaleJob(job, `Discarding stale policy job for licence ${licenceId}`)
    await deletePolicyJob(sqsQueueUrl, message.ReceiptHandle)
    return
  }

  await setJobStatus(job, MARINE_PLAN_POLICY_JOB_STATUS.COMPUTING)

  try {
    await computeAndStorePolicies(job, licence, db)
    await deletePolicyJob(sqsQueueUrl, message.ReceiptHandle)
  } catch (error) {
    await handleJobFailure(job, error, message, retryAfterCapMs)
  }
}

/**
 * Processes one message from the dead-letter queue. A message dead-letters
 * once the main queue's redrive budget (maxReceiveCount: 5) is spent, so the
 * job is marked failed — the front end then offers a Retry that queues a
 * fresh job. The update is guarded on policyJobId AND queuedAt: a retry after
 * failure reuses the same policyJobId (same geometry hash), so the timestamp
 * is what stops a lingering dead-lettered message failing the new run.
 */
export const processDlqJob = async (server, message) => {
  const { db, logger } = server
  const { sqsDlqUrl } = config.get('marinePlanPolicies')

  const body = parseMessageBody(message, logger)
  if (body) {
    const { licenceId, policyJobId, queuedAt } = body
    const job = {
      collection: db.collection(collectionMarineLicences),
      _id: ObjectId.createFromHexString(licenceId),
      licenceId,
      policyJobId,
      logger
    }
    const result = await job.collection.updateOne(
      {
        _id: job._id,
        marinePlanPolicyJobId: policyJobId,
        ...(queuedAt && { marinePlanPolicyJobQueuedAt: new Date(queuedAt) })
      },
      { $set: { marinePlanPolicyJob: MARINE_PLAN_POLICY_JOB_STATUS.FAILED } }
    )
    if (result.matchedCount > 0) {
      logger.warn(
        {
          event: {
            action: MARINE_PLAN_POLICY_EVENT_ACTION.JOB_FAILED,
            outcome: 'failure'
          }
        },
        `Policy job dead-lettered and marked failed for licence ${licenceId}`
      )
    } else {
      logStaleJob(
        job,
        `Discarding stale dead-lettered policy job for licence ${licenceId}`
      )
    }
  }
  await deletePolicyJob(sqsDlqUrl, message.ReceiptHandle)
}
