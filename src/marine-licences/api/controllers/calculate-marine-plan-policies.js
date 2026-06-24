import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { calculateMarinePlanPoliciesSchema } from '../../models/marine-plan-policy.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'
import { MARINE_PLAN_POLICY_JOB_STATUS } from '../../constants/marine-licence.js'
import { sendPolicyJob } from '../helpers/marine-plan-policies/sqs-client.js'

const ACTIVE_OR_READY = [
  MARINE_PLAN_POLICY_JOB_STATUS.PENDING,
  MARINE_PLAN_POLICY_JOB_STATUS.COMPUTING,
  MARINE_PLAN_POLICY_JOB_STATUS.READY
]

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

      // Atomically create a job ONLY if there isn't an active/ready one.
      // $nin also matches when the field is absent (new licence) or null (reset
      // after a geometry edit) and 'failed' (a retry) — i.e. exactly the
      // "no job in flight" states. Two concurrent requests: the first flips the
      // status to 'pending', so the second no longer matches the filter and
      // returns null. jobId is a fresh per-request ID, so every retry is its
      // own message.
      const jobId = new ObjectId().toHexString()
      const claim = await collection.findOneAndUpdate(
        { _id, marinePlanPolicyJob: { $nin: ACTIVE_OR_READY } },
        {
          $set: {
            marinePlanPolicyJob: MARINE_PLAN_POLICY_JOB_STATUS.PENDING,
            marinePlanPolicyJobId: jobId,
            updatedAt,
            updatedBy
          }
        },
        { returnDocument: 'after' }
      )

      if (!claim) {
        return h
          .response({
            message: 'success',
            value: {
              marinePlanPolicyJob: marineLicence.marinePlanPolicyJob ?? null
            }
          })
          .code(StatusCodes.ACCEPTED)
      }

      try {
        await sendPolicyJob({ licenceId: id, policyJobId: jobId })
      } catch (error) {
        // Roll back so the document is not stuck in 'pending' with no
        // message in flight (the idempotency guard would block retries)
        await collection.updateOne(
          { _id },
          {
            $set: {
              marinePlanPolicyJob: null,
              marinePlanPolicyJobId: null
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
