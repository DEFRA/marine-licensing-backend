import { ObjectId } from 'mongodb'
import { config } from '../../../config.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'
import { POLICY_JOB_STATUS } from '../../constants/marine-licence.js'
import { queryArcGISPolicies } from './arcgis-client.js'
import { getPolicyContent } from './policy-wording-client.js'
import { deletePolicyJob, extendVisibility } from './policies-sqs-client.js'
import { RetryAfterError } from './policies-http.js'

const millisecondsPerSecond = 1000

const parseMessageBody = (message, logger) => {
  try {
    const { licenceId, policyJobId } = JSON.parse(message.Body)
    if (!licenceId || !policyJobId) {
      throw new Error('licenceId and policyJobId are required')
    }
    return { licenceId, policyJobId }
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

/**
 * Processes one policy-calculation job from the main queue.
 *
 * The message is deleted on success and when it is stale (the licence's
 * policyJobId no longer matches, i.e. sites were edited after it was queued)
 * or older than the 36-hour abandonment budget. On transient failure the
 * message is left on the queue so SQS redelivers it after the visibility
 * timeout — abandonment is owned by the time check here, not the queue's
 * redrive policy, so hard upstream outages pause and resume on their own.
 */
export const processPolicyJob = async (server, message) => {
  const { db, logger } = server
  const { sqsQueueUrl, abandonAfterMs, retryAfterCapMs } =
    config.get('policies')

  const body = parseMessageBody(message, logger)
  if (!body) {
    await deletePolicyJob(sqsQueueUrl, message.ReceiptHandle)
    return
  }
  const { licenceId, policyJobId } = body
  const _id = ObjectId.createFromHexString(licenceId)
  const collection = db.collection(collectionMarineLicences)

  const licence = await collection.findOne({ _id })
  if (!licence || licence.policyJobId !== policyJobId) {
    logger.info(
      { event: { action: 'mp-policies:job-stale', outcome: 'success' } },
      `Discarding stale policy job for licence ${licenceId}`
    )
    await deletePolicyJob(sqsQueueUrl, message.ReceiptHandle)
    return
  }

  const queuedAt = new Date(licence.policyJobQueuedAt).getTime()
  if (Date.now() - queuedAt > abandonAfterMs) {
    await collection.updateOne(
      { _id, policyJobId },
      { $set: { policyJob: POLICY_JOB_STATUS.ABANDONED } }
    )
    logger.warn(
      { event: { action: 'mp-policies:job-abandoned', outcome: 'failure' } },
      `Policy job abandoned after exceeding the retry budget for licence ${licenceId}`
    )
    await deletePolicyJob(sqsQueueUrl, message.ReceiptHandle)
    return
  }

  await collection.updateOne(
    { _id, policyJobId },
    { $set: { policyJob: POLICY_JOB_STATUS.COMPUTING } }
  )

  try {
    const marinePlanPolicies = await fetchPolicies({
      siteDetails: licence.siteDetails,
      db,
      logger
    })

    // Conditional on policyJobId so a site edit mid-flight is never overwritten
    const result = await collection.updateOne(
      { _id, policyJobId },
      {
        $set: { marinePlanPolicies, policyJob: POLICY_JOB_STATUS.READY }
      }
    )
    if (result.matchedCount > 0) {
      logger.info(
        { event: { action: 'mp-policies:job-complete', outcome: 'success' } },
        `Policy job complete for licence ${licenceId}: ${marinePlanPolicies.length} applicable policies`
      )
    } else {
      logger.info(
        { event: { action: 'mp-policies:job-stale', outcome: 'success' } },
        `Discarding policy job result computed for stale sites on licence ${licenceId}`
      )
    }
    await deletePolicyJob(sqsQueueUrl, message.ReceiptHandle)
  } catch (error) {
    logger.error(
      structureErrorForECS(error),
      `Policy calculation failed for licence ${licenceId}; the queue will retry`
    )
    await collection.updateOne(
      { _id, policyJobId },
      { $set: { policyJob: POLICY_JOB_STATUS.FAILED } }
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
}

/**
 * Processes one message from the dead-letter queue (poison-message backstop).
 * Only marks the job abandoned if the licence still references this job —
 * a stale DLQ message must never abandon a freshly re-triggered job.
 */
export const processDlqJob = async (server, message) => {
  const { db, logger } = server
  const { sqsDlqUrl } = config.get('policies')

  const body = parseMessageBody(message, logger)
  if (body) {
    const { licenceId, policyJobId } = body
    const result = await db
      .collection(collectionMarineLicences)
      .updateOne(
        { _id: ObjectId.createFromHexString(licenceId), policyJobId },
        { $set: { policyJob: POLICY_JOB_STATUS.ABANDONED } }
      )
    if (result.matchedCount > 0) {
      logger.warn(
        { event: { action: 'mp-policies:job-abandoned', outcome: 'failure' } },
        `Policy job dead-lettered and marked abandoned for licence ${licenceId}`
      )
    } else {
      logger.info(
        { event: { action: 'mp-policies:job-stale', outcome: 'success' } },
        `Discarding stale dead-lettered policy job for licence ${licenceId}`
      )
    }
  }
  await deletePolicyJob(sqsDlqUrl, message.ReceiptHandle)
}
