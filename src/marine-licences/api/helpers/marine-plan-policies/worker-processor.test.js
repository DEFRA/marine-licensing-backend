import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { processPolicyJob, processDlqJob } from './policies-worker-processor.js'
import { queryArcGISPolicies } from './arcgis-client.js'
import { getPolicyContent } from './policy-wording-client.js'
import { deletePolicyJob, extendVisibility } from './policies-sqs-client.js'
import { RetryAfterError } from './policies-http.js'

vi.mock('./arcgis-client.js', () => ({
  queryArcGISPolicies: vi.fn()
}))
vi.mock('./policy-wording-client.js', () => ({
  getPolicyContent: vi.fn()
}))
vi.mock('./policies-sqs-client.js', () => ({
  deletePolicyJob: vi.fn(),
  extendVisibility: vi.fn()
}))

const queueUrl =
  'http://localhost:4566/000000000000/marine_licensing_policies.fifo'
const dlqUrl =
  'http://localhost:4566/000000000000/marine_licensing_policies-deadletter.fifo'

describe('policies-worker-processor', () => {
  const licenceId = new ObjectId().toHexString()
  const policyJobId = 'a'.repeat(64)
  const receiptHandle = 'receipt-1'

  const buildMessage = (body = { licenceId, policyJobId }) => ({
    Body: typeof body === 'string' ? body : JSON.stringify(body),
    ReceiptHandle: receiptHandle
  })

  const buildLicence = (overrides = {}) => ({
    _id: ObjectId.createFromHexString(licenceId),
    policyJobId,
    policyJobQueuedAt: new Date(),
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

      expect(deletePolicyJob).toHaveBeenCalledWith(queueUrl, receiptHandle)
      expect(mockUpdateOne).not.toHaveBeenCalled()
      expect(server.logger.error).toHaveBeenCalled()
    })

    it('should discard stale messages when the licence no longer exists', async () => {
      const { server, mockUpdateOne } = setupMocks(null)

      await processPolicyJob(server, buildMessage())

      expect(deletePolicyJob).toHaveBeenCalledWith(queueUrl, receiptHandle)
      expect(mockUpdateOne).not.toHaveBeenCalled()
    })

    it('should discard stale messages when sites were edited after queueing', async () => {
      const { server, mockUpdateOne } = setupMocks(
        buildLicence({ policyJobId: 'a-newer-hash' })
      )

      await processPolicyJob(server, buildMessage())

      expect(deletePolicyJob).toHaveBeenCalledWith(queueUrl, receiptHandle)
      expect(mockUpdateOne).not.toHaveBeenCalled()
      expect(queryArcGISPolicies).not.toHaveBeenCalled()
    })

    it('should compute policies, store them with their content, mark ready and delete the message', async () => {
      const licence = buildLicence()
      const { server, mockUpdateOne } = setupMocks(licence)
      const policyContent = {
        policy: '<p>statement</p>',
        policyAim: '<p>aim</p>',
        whatIsIt: '<p>what</p>',
        whyIsItImportant: '<p>why</p>',
        howWillThisBeImplemented: '<p>how</p>'
      }
      vi.mocked(queryArcGISPolicies).mockResolvedValue([
        { policyCode: 'S-FISH-1', sector: 'Fishing' }
      ])
      vi.mocked(getPolicyContent).mockResolvedValue(policyContent)

      await processPolicyJob(server, buildMessage())

      expect(queryArcGISPolicies).toHaveBeenCalledWith({
        siteDetails: licence.siteDetails,
        logger: server.logger
      })
      expect(getPolicyContent).toHaveBeenCalledWith({
        policyCode: 'S-FISH-1',
        db: server.db,
        logger: server.logger
      })
      expect(mockUpdateOne).toHaveBeenNthCalledWith(
        1,
        { _id: ObjectId.createFromHexString(licenceId), policyJobId },
        { $set: { policyJob: 'computing' } }
      )
      expect(mockUpdateOne).toHaveBeenNthCalledWith(
        2,
        { _id: ObjectId.createFromHexString(licenceId), policyJobId },
        {
          $set: {
            marinePlanPolicies: [
              {
                policyCode: 'S-FISH-1',
                sector: 'Fishing',
                ...policyContent
              }
            ],
            policyJob: 'ready'
          }
        }
      )
      expect(deletePolicyJob).toHaveBeenCalledWith(queueUrl, receiptHandle)
    })

    it('should still delete the message when the result write finds the job stale', async () => {
      const { server, mockUpdateOne } = setupMocks(buildLicence())
      vi.mocked(queryArcGISPolicies).mockResolvedValue([])
      // computing update matches, ready update does not (site edited mid-flight)
      mockUpdateOne
        .mockResolvedValueOnce({ matchedCount: 1 })
        .mockResolvedValueOnce({ matchedCount: 0 })

      await processPolicyJob(server, buildMessage())

      expect(deletePolicyJob).toHaveBeenCalledWith(queueUrl, receiptHandle)
    })

    it('should keep the message and leave the status as computing on transient errors', async () => {
      const { server, mockUpdateOne } = setupMocks(buildLicence())
      vi.mocked(queryArcGISPolicies).mockRejectedValue(
        new Error('ArcGIS timed out')
      )

      await processPolicyJob(server, buildMessage())

      // only the computing write — failed is owned by the DLQ worker
      expect(mockUpdateOne).toHaveBeenCalledTimes(1)
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: ObjectId.createFromHexString(licenceId), policyJobId },
        { $set: { policyJob: 'computing' } }
      )
      expect(deletePolicyJob).not.toHaveBeenCalled()
      expect(extendVisibility).not.toHaveBeenCalled()
      expect(server.logger.error).toHaveBeenCalled()
    })

    it('should honour Retry-After by extending the message visibility', async () => {
      const { server } = setupMocks(buildLicence())
      vi.mocked(queryArcGISPolicies).mockRejectedValue(
        new RetryAfterError('429', { retryAfterSeconds: 30, statusCode: 429 })
      )

      await processPolicyJob(server, buildMessage())

      expect(extendVisibility).toHaveBeenCalledWith(receiptHandle, 30)
      expect(deletePolicyJob).not.toHaveBeenCalled()
    })

    it('should cap the honoured Retry-After at ten minutes', async () => {
      const { server } = setupMocks(buildLicence())
      vi.mocked(queryArcGISPolicies).mockRejectedValue(
        new RetryAfterError('429', {
          retryAfterSeconds: 86_400,
          statusCode: 429
        })
      )

      await processPolicyJob(server, buildMessage())

      expect(extendVisibility).toHaveBeenCalledWith(receiptHandle, 600)
    })
  })

  describe('processDlqJob', () => {
    it('should mark the job failed when the licence still references it', async () => {
      const { server, mockUpdateOne } = setupMocks(null)

      await processDlqJob(server, buildMessage())

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: ObjectId.createFromHexString(licenceId), policyJobId },
        { $set: { policyJob: 'failed' } }
      )
      expect(deletePolicyJob).toHaveBeenCalledWith(dlqUrl, receiptHandle)
      expect(server.logger.warn).toHaveBeenCalled()
    })

    it('should guard the failed write on queuedAt when the message carries it', async () => {
      const queuedAt = new Date('2026-06-11T10:00:00.000Z')
      const { server, mockUpdateOne } = setupMocks(null)

      await processDlqJob(
        server,
        buildMessage({ licenceId, policyJobId, queuedAt })
      )

      expect(mockUpdateOne).toHaveBeenCalledWith(
        {
          _id: ObjectId.createFromHexString(licenceId),
          policyJobId,
          policyJobQueuedAt: queuedAt
        },
        { $set: { policyJob: 'failed' } }
      )
    })

    it('should not fail a re-triggered job when the dead-lettered message is stale', async () => {
      const { server, mockUpdateOne } = setupMocks(null)
      mockUpdateOne.mockResolvedValue({ matchedCount: 0 })

      await processDlqJob(server, buildMessage())

      expect(server.logger.warn).not.toHaveBeenCalled()
      expect(deletePolicyJob).toHaveBeenCalledWith(dlqUrl, receiptHandle)
    })

    it('should delete malformed dead-lettered messages without touching the database', async () => {
      const { server, mockUpdateOne } = setupMocks(null)

      await processDlqJob(server, buildMessage('not json'))

      expect(mockUpdateOne).not.toHaveBeenCalled()
      expect(deletePolicyJob).toHaveBeenCalledWith(dlqUrl, receiptHandle)
    })
  })
})
