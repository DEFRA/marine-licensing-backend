import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { calculatePoliciesSchema } from '../../models/calculate-policies.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'
import { POLICY_JOB_STATUS } from '../../constants/marine-licence.js'
import { computePolicyJobId } from '../helpers/policy-job-hash.js'
import { sendPolicyJob } from '../helpers/policies-sqs-client.js'

const IN_FLIGHT_OR_READY = [
  POLICY_JOB_STATUS.PENDING,
  POLICY_JOB_STATUS.COMPUTING,
  POLICY_JOB_STATUS.READY
]

export const calculatePoliciesController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: calculatePoliciesSchema
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
        marineLicence.policyJobId === policyJobId &&
        IN_FLIGHT_OR_READY.includes(marineLicence.policyJob)
      ) {
        return h
          .response({
            message: 'success',
            value: { policyJob: marineLicence.policyJob }
          })
          .code(StatusCodes.ACCEPTED)
      }

      await collection.updateOne(
        { _id },
        {
          $set: {
            policyJob: POLICY_JOB_STATUS.PENDING,
            policyJobId,
            policyJobQueuedAt: new Date(),
            updatedAt,
            updatedBy
          }
        }
      )

      try {
        await sendPolicyJob({ licenceId: id, policyJobId })
      } catch (error) {
        // Roll back so the document is not stuck in 'pending' with no
        // message in flight (the idempotency guard would block retries)
        await collection.updateOne(
          { _id },
          {
            $set: {
              policyJob: null,
              policyJobId: null,
              policyJobQueuedAt: null
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
          value: { policyJob: POLICY_JOB_STATUS.PENDING }
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
