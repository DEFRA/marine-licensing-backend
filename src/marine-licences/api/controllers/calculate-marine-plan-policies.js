import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { calculateMarinePlanPoliciesSchema } from '../../models/marine-plan-policy.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'
import { MARINE_PLAN_POLICY_JOB_STATUS } from '../../constants/marine-licence.js'
import { computePolicyJobId } from '../helpers/marine-plan-policies/policy-job.js'
import { sendPolicyJob } from '../helpers/marine-plan-policies/sqs-client.js'

const IN_FLIGHT_OR_READY = new Set([
  MARINE_PLAN_POLICY_JOB_STATUS.PENDING,
  MARINE_PLAN_POLICY_JOB_STATUS.COMPUTING,
  MARINE_PLAN_POLICY_JOB_STATUS.READY
])

export const calculateMarinePlanPoliciesController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: calculateMarinePlanPoliciesSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db, logger } = request
      const { id, updatedAt, updatedBy } = payload
      const _id = ObjectId.createFromHexString(id)
      const collection = db.collection(collectionMarineLicences)

      const marineLicence = await collection.findOne({ _id })
      if (!marineLicence) {
        throw Boom.notFound('Marine licence not found')
      }
      if (!marineLicence.siteDetails?.length) {
        throw Boom.badRequest('Marine licence has no site details')
      }

      const policyJobId = computePolicyJobId(id, marineLicence.siteDetails)

      // Same geometries and a job already queued, running, or complete:
      // nothing to do. SQS FIFO dedupe only covers a 5-minute window, so this
      // guard is what actually makes repeated clicks idempotent.
      if (
        marineLicence.marinePlanPolicyJobId === policyJobId &&
        IN_FLIGHT_OR_READY.has(marineLicence.marinePlanPolicyJob)
      ) {
        return h
          .response({
            message: 'success',
            value: { marinePlanPolicyJob: marineLicence.marinePlanPolicyJob }
          })
          .code(StatusCodes.ACCEPTED)
      }

      const queuedAt = new Date()
      await collection.updateOne(
        { _id },
        {
          $set: {
            marinePlanPolicyJob: MARINE_PLAN_POLICY_JOB_STATUS.PENDING,
            marinePlanPolicyJobId: policyJobId,
            marinePlanPolicyJobQueuedAt: queuedAt,
            updatedAt,
            updatedBy
          }
        }
      )

      try {
        // queuedAt rides in the message so the DLQ worker can tell a stale
        // dead-letter from a retried job that reuses the same policyJobId
        await sendPolicyJob({ licenceId: id, policyJobId, queuedAt })
      } catch (error) {
        // Roll back so the document is not stuck in 'pending' with no
        // message in flight (the idempotency guard would block retries)
        await collection.updateOne(
          { _id },
          {
            $set: {
              marinePlanPolicyJob: null,
              marinePlanPolicyJobId: null,
              marinePlanPolicyJobQueuedAt: null
            }
          }
        )
        logger.error(
          structureErrorForECS(error),
          `Failed to queue policy calculation for licence ${id}`
        )
        throw Boom.internal('Error queueing policy calculation')
      }

      return h
        .response({
          message: 'success',
          value: { marinePlanPolicyJob: MARINE_PLAN_POLICY_JOB_STATUS.PENDING }
        })
        .code(StatusCodes.ACCEPTED)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(
        `Error requesting policy calculation: ${error.message}`
      )
    }
  }
}
