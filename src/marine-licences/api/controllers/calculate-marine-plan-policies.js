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

      // Only create a new job if there isn't already an active one.
      // We allow a new job when the status is missing, null, or 'failed'.
      // This update is atomic, so only one request can create a job. If two
      // requests happen at the same time, the first sets the status to
      // 'pending'. The second sees that a job already exists and does nothing.
      // Every retry uses a new jobId.
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
