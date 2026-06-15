import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updateSiteDetailsController } from './update-site-details.js'
import Boom from '@hapi/boom'
import { mockFileUploadSite } from '../../../../tests/test.fixture.js'
import { computePolicyJobId } from '../helpers/marine-plan-policies/policy-job.js'

describe('PATCH /marine-licences/site-details', () => {
  const payloadValidator = updateSiteDetailsController.options.validate.payload
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  it('should fail if siteDetails are missing', () => {
    const result = payloadValidator.validate({})
    expect(result.error.message).toContain('SITE_DETAILS_REQUIRED')
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      siteDetails: [mockFileUploadSite],
      ...mockAuditPayload
    }

    const mockError = 'Database failed'

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOne: vi.fn().mockResolvedValue(null),
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      updateSiteDetailsController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow(`Error updating site details: ${mockError}`)
  })

  it('should return a  404 if id is not correct', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      siteDetails: [mockFileUploadSite],
      ...mockAuditPayload
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOne: vi.fn().mockResolvedValue(null),
        updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }
    })

    vi.spyOn(Boom, 'notFound')

    await expect(() =>
      updateSiteDetailsController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow(`Marine licence not found`)
  })

  describe('policy state reset', () => {
    const buildPayload = () => ({
      id: new ObjectId().toHexString(),
      siteDetails: [mockFileUploadSite],
      ...mockAuditPayload
    })

    const setupMocks = (existingDoc) => {
      const { mockMongo } = global
      const mockUpdateOne = vi.fn().mockResolvedValue({ matchedCount: 1 })
      vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
        findOne: vi.fn().mockResolvedValue(existingDoc),
        updateOne: mockUpdateOne
      }))
      return mockUpdateOne
    }

    it('should not touch policy state when no policy job exists', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload()
      const mockUpdateOne = setupMocks({ _id: mockPayload.id })

      await updateSiteDetailsController.handler(
        { db: mockMongo, payload: mockPayload },
        mockHandler
      )

      const setFields = mockUpdateOne.mock.calls[0][1].$set
      expect(setFields).not.toHaveProperty('marinePlanPolicyJob')
      expect(setFields).not.toHaveProperty('marinePlanPolicies')
    })

    it('should discard computed policies when the geometry changes', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload()
      const mockUpdateOne = setupMocks({
        _id: mockPayload.id,
        marinePlanPolicyJobId: 'hash-of-the-previous-geometry'
      })

      await updateSiteDetailsController.handler(
        { db: mockMongo, payload: mockPayload },
        mockHandler
      )

      const setFields = mockUpdateOne.mock.calls[0][1].$set
      expect(setFields).toMatchObject({
        marinePlanPolicyJob: null,
        marinePlanPolicyJobId: null,
        marinePlanPolicyJobQueuedAt: null,
        marinePlanPolicies: []
      })
      expect(setFields).not.toHaveProperty('marinePlanPolicyResponses')
    })

    it('should keep computed policies when the geometry is unchanged', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload()
      const mockUpdateOne = setupMocks({
        _id: mockPayload.id,
        marinePlanPolicyJobId: computePolicyJobId(mockPayload.id, [
          mockFileUploadSite
        ])
      })

      await updateSiteDetailsController.handler(
        { db: mockMongo, payload: mockPayload },
        mockHandler
      )

      const setFields = mockUpdateOne.mock.calls[0][1].$set
      expect(setFields).not.toHaveProperty('marinePlanPolicyJob')
      expect(setFields).not.toHaveProperty('marinePlanPolicies')
    })
  })
})
