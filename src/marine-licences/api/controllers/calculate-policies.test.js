import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { calculatePoliciesController } from './calculate-policies.js'
import { computePolicyJobId } from '../helpers/policy-job-hash.js'
import { sendPolicyJob } from '../helpers/policies-sqs-client.js'
import { mockFileUploadSite } from '../../../../tests/test.fixture.js'

vi.mock('../helpers/policies-sqs-client.js', () => ({
  sendPolicyJob: vi.fn()
}))

describe('POST /marine-licence/calculate-policies', () => {
  const payloadValidator = calculatePoliciesController.options.validate.payload
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const buildPayload = (overrides = {}) => ({
    id: new ObjectId().toHexString(),
    ...mockAuditPayload,
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
    const request = {
      db: mockMongo,
      payload: buildPayload({ id: licence?._id?.toHexString() }),
      logger: { info: vi.fn(), error: vi.fn() }
    }
    return { request, mockFindOne, mockUpdateOne }
  }

  describe('validation', () => {
    it('should require a marine licence id', () => {
      const result = payloadValidator.validate({})
      expect(result.error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
    })

    it('should accept a valid id', () => {
      const result = payloadValidator.validate({
        id: new ObjectId().toHexString()
      })
      expect(result.error).toBeUndefined()
    })
  })

  describe('handler', () => {
    it('should throw 404 when the marine licence does not exist', async () => {
      const { mockMongo, mockHandler } = global
      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        findOne: vi.fn().mockResolvedValue(null)
      }))

      await expect(() =>
        calculatePoliciesController.handler(
          {
            db: mockMongo,
            payload: buildPayload(),
            logger: { error: vi.fn() }
          },
          mockHandler
        )
      ).rejects.toThrow('Marine licence not found')
    })

    it('should throw 400 when the marine licence has no site details', async () => {
      const _id = new ObjectId()
      const { request } = setupMocks({ _id, siteDetails: [] })

      await expect(() =>
        calculatePoliciesController.handler(request, global.mockHandler)
      ).rejects.toThrow('Marine licence has no site details')
    })

    it('should queue the job, set pending state, and return 202', async () => {
      const _id = new ObjectId()
      const { request, mockUpdateOne } = setupMocks({
        _id,
        siteDetails: [mockFileUploadSite]
      })
      const id = _id.toHexString()
      const expectedJobId = computePolicyJobId(id, [mockFileUploadSite])

      await calculatePoliciesController.handler(request, global.mockHandler)

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id },
        {
          $set: {
            policyJob: 'pending',
            policyJobId: expectedJobId,
            policyJobQueuedAt: expect.any(Date),
            ...mockAuditPayload
          }
        }
      )
      expect(sendPolicyJob).toHaveBeenCalledWith({
        licenceId: id,
        policyJobId: expectedJobId,
        queuedAt: expect.any(Date)
      })
      expect(global.mockHandler.response).toHaveBeenCalledWith({
        message: 'success',
        value: { policyJob: 'pending' }
      })
      expect(global.mockHandler.code).toHaveBeenCalledWith(202)
    })

    it('should be idempotent when the same geometry already has a job in flight', async () => {
      const _id = new ObjectId()
      const id = _id.toHexString()
      const policyJobId = computePolicyJobId(id, [mockFileUploadSite])
      const { request, mockUpdateOne } = setupMocks({
        _id,
        siteDetails: [mockFileUploadSite],
        policyJobId,
        policyJob: 'ready'
      })

      await calculatePoliciesController.handler(request, global.mockHandler)

      expect(mockUpdateOne).not.toHaveBeenCalled()
      expect(sendPolicyJob).not.toHaveBeenCalled()
      expect(global.mockHandler.response).toHaveBeenCalledWith({
        message: 'success',
        value: { policyJob: 'ready' }
      })
      expect(global.mockHandler.code).toHaveBeenCalledWith(202)
    })

    it('should re-queue when the same geometry previously failed', async () => {
      const _id = new ObjectId()
      const id = _id.toHexString()
      const policyJobId = computePolicyJobId(id, [mockFileUploadSite])
      const { request } = setupMocks({
        _id,
        siteDetails: [mockFileUploadSite],
        policyJobId,
        policyJob: 'failed'
      })

      await calculatePoliciesController.handler(request, global.mockHandler)

      expect(sendPolicyJob).toHaveBeenCalled()
    })

    it('should roll back the pending state and throw 500 when the queue send fails', async () => {
      const _id = new ObjectId()
      const { request, mockUpdateOne } = setupMocks({
        _id,
        siteDetails: [mockFileUploadSite]
      })
      vi.mocked(sendPolicyJob).mockRejectedValueOnce(new Error('SQS down'))

      await expect(() =>
        calculatePoliciesController.handler(request, global.mockHandler)
      ).rejects.toThrow('Error queueing policy calculation')

      expect(mockUpdateOne).toHaveBeenLastCalledWith(
        { _id },
        {
          $set: {
            policyJob: null,
            policyJobId: null,
            policyJobQueuedAt: null
          }
        }
      )
      expect(request.logger.error).toHaveBeenCalled()
    })
  })
})
