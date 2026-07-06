import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { processPolicyJob, processDlqJob } from './worker-processor.js'
import { queryArcGISPolicies } from './arcgis-client.js'
import { getPoliciesContent } from './policy-content-client.js'
import { deletePolicyJob } from './sqs-client.js'

vi.mock('./arcgis-client.js', () => ({
  queryArcGISPolicies: vi.fn()
}))
vi.mock('./policy-content-client.js', () => ({
  getPoliciesContent: vi.fn()
}))
vi.mock('./sqs-client.js', () => ({
  deletePolicyJob: vi.fn()
}))

const queueName = 'marine_licensing_policies'
const dlqName = 'marine_licensing_policies-deadletter'

describe('policies-worker-processor', () => {
  const licenceId = new ObjectId().toHexString()
  const policyJobId = 'a'.repeat(64)
  const receiptHandle = 'receipt-1'

  const buildMessage = (
    body = { licenceId, policyJobId },
    receiveCount = '1'
  ) => ({
    Body: typeof body === 'string' ? body : JSON.stringify(body),
    ReceiptHandle: receiptHandle,
    Attributes: { ApproximateReceiveCount: receiveCount }
  })

  const buildLicence = (overrides = {}) => ({
    _id: ObjectId.createFromHexString(licenceId),
    marinePlanPolicyJobId: policyJobId,
    siteDetails: [{ coordinatesType: 'coordinates' }],
    ...overrides
  })

  const setupMocks = (licence) => {
    const { mockMongo } = global
    const mockFindOne = vi.fn().mockResolvedValue(licence)
    const mockUpdateOne = vi.fn().mockResolvedValue({ matchedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
      findOne: mockFindOne,
      updateOne: mockUpdateOne
    }))
    const server = {
      db: mockMongo,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    }
    return { server, mockFindOne, mockUpdateOne }
  }

  describe('processPolicyJob', () => {
    it('should discard malformed messages', async () => {
      const { server, mockUpdateOne } = setupMocks(null)

      await processPolicyJob(server, buildMessage('not json'))

      expect(deletePolicyJob).toHaveBeenCalledWith(queueName, receiptHandle)
      expect(mockUpdateOne).not.toHaveBeenCalled()
      expect(server.logger.error).toHaveBeenCalled()
    })

    it('should discard stale messages when the licence no longer exists', async () => {
      const { server, mockUpdateOne } = setupMocks(null)

      await processPolicyJob(server, buildMessage())

      expect(deletePolicyJob).toHaveBeenCalledWith(queueName, receiptHandle)
      expect(mockUpdateOne).not.toHaveBeenCalled()
    })

    it('should discard stale messages when sites were edited after queueing', async () => {
      const { server, mockUpdateOne } = setupMocks(
        buildLicence({ marinePlanPolicyJobId: 'a-newer-hash' })
      )

      await processPolicyJob(server, buildMessage())

      expect(deletePolicyJob).toHaveBeenCalledWith(queueName, receiptHandle)
      expect(mockUpdateOne).not.toHaveBeenCalled()
      expect(queryArcGISPolicies).not.toHaveBeenCalled()
    })

    it('should compute policies, store them with their content, mark ready and delete the message', async () => {
      const licence = buildLicence()
      const { server, mockUpdateOne } = setupMocks(licence)
      const arcgisPolicies = [{ policyCode: 'S-FISH-1', sector: 'Fishing' }]
      const mergedPolicies = [
        {
          policyCode: 'S-FISH-1',
          sector: 'Fishing',
          policy: '<p>statement</p>',
          policyAim: '<p>aim</p>',
          whatIsIt: '<p>what</p>',
          whyIsItImportant: '<p>why</p>',
          howWillThisBeImplemented: '<p>how</p>'
        }
      ]
      vi.mocked(queryArcGISPolicies).mockResolvedValue(arcgisPolicies)
      vi.mocked(getPoliciesContent).mockResolvedValue(mergedPolicies)

      await processPolicyJob(server, buildMessage())

      expect(queryArcGISPolicies).toHaveBeenCalledWith({
        siteDetails: licence.siteDetails,
        licenceId,
        logger: server.logger
      })
      expect(getPoliciesContent).toHaveBeenCalledWith({
        policies: arcgisPolicies,
        db: server.db,
        logger: server.logger
      })
      expect(mockUpdateOne).toHaveBeenNthCalledWith(
        1,
        {
          _id: ObjectId.createFromHexString(licenceId),
          marinePlanPolicyJobId: policyJobId
        },
        { $set: { marinePlanPolicyJob: 'computing' } }
      )
      expect(mockUpdateOne).toHaveBeenNthCalledWith(
        2,
        {
          _id: ObjectId.createFromHexString(licenceId),
          marinePlanPolicyJobId: policyJobId
        },
        {
          $set: {
            marinePlanPolicies: mergedPolicies,
            marinePlanPoliciesCount: mergedPolicies.length,
            marinePlanPolicyJob: 'ready'
          }
        }
      )
      expect(deletePolicyJob).toHaveBeenCalledWith(queueName, receiptHandle)
    })

    it('should still delete the message when the result write finds the job stale', async () => {
      const { server, mockUpdateOne } = setupMocks(buildLicence())
      vi.mocked(queryArcGISPolicies).mockResolvedValue([])
      // computing update matches, ready update does not (site edited mid-flight)
      mockUpdateOne
        .mockResolvedValueOnce({ matchedCount: 1 })
        .mockResolvedValueOnce({ matchedCount: 0 })

      await processPolicyJob(server, buildMessage())

      expect(deletePolicyJob).toHaveBeenCalledWith(queueName, receiptHandle)
    })

    it('should keep the message and leave the status as computing on transient errors (non-final attempt)', async () => {
      const { server, mockUpdateOne } = setupMocks(buildLicence())
      vi.mocked(queryArcGISPolicies).mockRejectedValue(
        new Error('ArcGIS timed out')
      )

      await processPolicyJob(
        server,
        buildMessage({ licenceId, policyJobId }, '1')
      )

      // only the computing write — not the final attempt so no failed write
      expect(mockUpdateOne).toHaveBeenCalledTimes(1)
      expect(mockUpdateOne).toHaveBeenCalledWith(
        {
          _id: ObjectId.createFromHexString(licenceId),
          marinePlanPolicyJobId: policyJobId
        },
        { $set: { marinePlanPolicyJob: 'computing' } }
      )
      expect(deletePolicyJob).not.toHaveBeenCalled()
      expect(server.logger.error).toHaveBeenCalled()
    })

    it('should write failed on the final delivery attempt and leave the message to dead-letter naturally', async () => {
      const { server, mockUpdateOne } = setupMocks(buildLicence())
      vi.mocked(queryArcGISPolicies).mockRejectedValue(
        new Error('ArcGIS timed out')
      )

      await processPolicyJob(
        server,
        buildMessage({ licenceId, policyJobId }, '5')
      )

      expect(mockUpdateOne).toHaveBeenCalledTimes(2)
      expect(mockUpdateOne).toHaveBeenNthCalledWith(
        2,
        {
          _id: ObjectId.createFromHexString(licenceId),
          marinePlanPolicyJobId: policyJobId
        },
        { $set: { marinePlanPolicyJob: 'failed' } }
      )
      expect(deletePolicyJob).not.toHaveBeenCalled()
    })
  })

  describe('processDlqJob', () => {
    it('should mark the job failed when the licence still references it', async () => {
      const { server, mockUpdateOne } = setupMocks(null)

      await processDlqJob(server, buildMessage())

      expect(mockUpdateOne).toHaveBeenCalledWith(
        {
          _id: ObjectId.createFromHexString(licenceId),
          marinePlanPolicyJobId: policyJobId
        },
        { $set: { marinePlanPolicyJob: 'failed' } }
      )
      expect(deletePolicyJob).toHaveBeenCalledWith(dlqName, receiptHandle)
      expect(server.logger.warn).toHaveBeenCalled()
    })

    it('should not fail a re-triggered job when the dead-lettered message is stale', async () => {
      const { server, mockUpdateOne } = setupMocks(null)
      mockUpdateOne.mockResolvedValue({ matchedCount: 0 })

      await processDlqJob(server, buildMessage())

      expect(server.logger.warn).not.toHaveBeenCalled()
      expect(deletePolicyJob).toHaveBeenCalledWith(dlqName, receiptHandle)
    })

    it('should delete malformed dead-lettered messages without touching the database', async () => {
      const { server, mockUpdateOne } = setupMocks(null)

      await processDlqJob(server, buildMessage('not json'))

      expect(mockUpdateOne).not.toHaveBeenCalled()
      expect(deletePolicyJob).toHaveBeenCalledWith(dlqName, receiptHandle)
    })
  })
})
