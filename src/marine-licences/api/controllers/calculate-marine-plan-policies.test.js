import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { calculateMarinePlanPoliciesController } from './calculate-marine-plan-policies.js'
import { sendPolicyJob } from '../helpers/marine-plan-policies/sqs-client.js'
import { mockFileUploadSite } from '../../../../tests/test.fixture.js'

vi.mock('../helpers/marine-plan-policies/sqs-client.js', () => ({
  sendPolicyJob: vi.fn()
}))

const hexJobId = expect.stringMatching(/^[a-f0-9]{24}$/)

describe('POST /marine-licence/calculate-marine-plan-policies', () => {
  const payloadValidator =
    calculateMarinePlanPoliciesController.options.validate.payload
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const buildPayload = (overrides = {}) => ({
    id: new ObjectId().toHexString(),
    ...mockAuditPayload,
    ...overrides
  })

  const setupMocks = (licence, { claimWins = true } = {}) => {
    const { mockMongo } = global
    const mockFindOne = vi.fn().mockResolvedValue(licence)
    const mockUpdateOne = vi.fn().mockResolvedValue({ matchedCount: 1 })
    // findOneAndUpdate returns the claimed doc when no active job blocks it,
    // or null when one is already in flight.
    const mockFindOneAndUpdate = vi
      .fn()
      .mockResolvedValue(claimWins ? { _id: licence?._id } : null)
    vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
      findOne: mockFindOne,
      updateOne: mockUpdateOne,
      findOneAndUpdate: mockFindOneAndUpdate
    }))
    const request = {
      db: mockMongo,
      payload: buildPayload({ id: licence?._id?.toHexString() }),
      logger: { info: vi.fn(), error: vi.fn() }
    }
    return { request, mockFindOne, mockUpdateOne, mockFindOneAndUpdate }
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
        calculateMarinePlanPoliciesController.handler(
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
        calculateMarinePlanPoliciesController.handler(
          request,
          global.mockHandler
        )
      ).rejects.toThrow('Marine licence has no site details')
    })

    it('should atomically claim the job with a fresh per-click id, queue it, and return 202', async () => {
      const _id = new ObjectId()
      const { request, mockFindOneAndUpdate } = setupMocks({
        _id,
        siteDetails: [mockFileUploadSite]
      })
      const id = _id.toHexString()

      await calculateMarinePlanPoliciesController.handler(
        request,
        global.mockHandler
      )

      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        {
          _id,
          marinePlanPolicyJob: { $nin: ['pending', 'computing', 'ready'] }
        },
        {
          $set: {
            marinePlanPolicyJob: 'pending',
            marinePlanPolicyJobId: hexJobId,
            ...mockAuditPayload
          }
        },
        { returnDocument: 'after' }
      )
      // the same per-click id that was claimed is the one put on the queue
      const claimedJobId =
        mockFindOneAndUpdate.mock.calls[0][1].$set.marinePlanPolicyJobId
      expect(sendPolicyJob).toHaveBeenCalledWith({
        licenceId: id,
        policyJobId: claimedJobId
      })
      expect(global.mockHandler.response).toHaveBeenCalledWith({
        message: 'success',
        value: { marinePlanPolicyJob: 'pending' }
      })
      expect(global.mockHandler.code).toHaveBeenCalledWith(202)
    })

    it('should be idempotent when a job is already in flight', async () => {
      const _id = new ObjectId()
      const { request, mockUpdateOne } = setupMocks(
        {
          _id,
          siteDetails: [mockFileUploadSite],
          marinePlanPolicyJob: 'ready'
        },
        { claimWins: false }
      )

      await calculateMarinePlanPoliciesController.handler(
        request,
        global.mockHandler
      )

      expect(mockUpdateOne).not.toHaveBeenCalled()
      expect(sendPolicyJob).not.toHaveBeenCalled()
      expect(global.mockHandler.response).toHaveBeenCalledWith({
        message: 'success',
        value: { marinePlanPolicyJob: 'ready' }
      })
      expect(global.mockHandler.code).toHaveBeenCalledWith(202)
    })

    it('should re-queue when the previous job failed (retry)', async () => {
      const _id = new ObjectId()
      const { request } = setupMocks({
        _id,
        siteDetails: [mockFileUploadSite],
        marinePlanPolicyJob: 'failed'
      })

      await calculateMarinePlanPoliciesController.handler(
        request,
        global.mockHandler
      )

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
        calculateMarinePlanPoliciesController.handler(
          request,
          global.mockHandler
        )
      ).rejects.toThrow('Error queueing policy calculation')

      expect(mockUpdateOne).toHaveBeenLastCalledWith(
        { _id },
        {
          $set: {
            marinePlanPolicyJob: null,
            marinePlanPolicyJobId: null
          }
        }
      )
      expect(request.logger.error).toHaveBeenCalled()
    })
  })
})
