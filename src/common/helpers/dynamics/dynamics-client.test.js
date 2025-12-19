import { expect, vi } from 'vitest'
import Wreck from '@hapi/wreck'

import { config } from '../../../config.js'
import {
  getDynamicsAccessToken,
  sendExemptionToDynamics
} from './dynamics-client.js'
import { EXEMPTION_STATUS, EXEMPTION_TYPE } from '../../constants/exemption.js'

vi.mock('../../../config.js')
vi.mock('@hapi/wreck')

describe('Dynamics Client', () => {
  let mockServer
  const mockWreckPost = vi.mocked(Wreck.post).mockResolvedValue({
    payload: Buffer.from(JSON.stringify({ access_token: 'test_token' }))
  })

  beforeEach(() => {
    mockServer = {
      db: {
        collection: vi.fn().mockReturnValue({
          findOne: vi.fn(),
          updateOne: vi.fn()
        })
      }
    }
    config.get.mockImplementation(function (value) {
      return value === 'dynamics'
        ? {
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            scope: 'test-scope',
            maxRetries: 3,
            retryDelayMs: 60000,
            tokenUrl: 'https://localhost/oauth2/token',
            apiUrl: 'https://localhost/api/data/v9.2'
          }
        : 'http://localhost'
    })
  })

  describe('getDynamicsAccessToken', () => {
    it('should make POST request to config URL with client credentials', async () => {
      const result = await getDynamicsAccessToken()

      expect(result).toBe('test_token')
      expect(mockWreckPost).toHaveBeenCalledWith(
        'https://localhost/oauth2/token',
        expect.objectContaining({
          payload:
            'client_id=test-client-id&client_secret=test-client-secret&grant_type=client_credentials&scope=test-scope',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })
      )
    })

    it('should throw error if request fails', async () => {
      mockWreckPost.mockImplementation(function () {
        throw new Error('Network error')
      })

      await expect(getDynamicsAccessToken()).rejects.toThrow('Network error')
    })

    it('should throw error if response does not contain access_token', async () => {
      mockWreckPost.mockReturnValue({
        payload: Buffer.from('{}')
      })
      await expect(getDynamicsAccessToken()).rejects.toThrow(
        'Dynamics token request failed'
      )
    })

    it('should throw error with Dynamics error description when token request fails', async () => {
      const mockError = new Error('Response Error: 400 Bad Request')

      mockWreckPost.mockImplementation(function () {
        throw mockError
      })

      await expect(getDynamicsAccessToken()).rejects.toThrow(
        'Response Error: 400 Bad Request'
      )
    })
  })

  describe('sendExemptionToDynamics', () => {
    const mockQueueItem = {
      applicationReferenceNumber: 'TEST-REF-001'
    }

    const mockExemption = {
      _id: '123',
      contactId: 'test-contact-id',
      projectName: 'Test Project',
      reference: 'TEST-REF-001',
      organisation: {
        id: 'test-org-id',
        userRelationshipType: 'Employee'
      }
    }

    const mockAccessToken = 'test-access-token'

    beforeEach(() => {
      mockWreckPost.mockResolvedValue({
        payload: { id: 'dynamics-record-id' },
        res: { statusCode: 202 }
      })
    })

    it('should send exemption data to Dynamics with correct payload and headers', async () => {
      mockServer.db.collection().findOne.mockResolvedValue(mockExemption)

      const result = await sendExemptionToDynamics(
        mockServer,
        mockAccessToken,
        mockQueueItem
      )

      expect(result).toEqual({ id: 'dynamics-record-id' })
      expect(mockServer.db.collection).toHaveBeenCalledWith('exemptions')
      expect(mockServer.db.collection().findOne).toHaveBeenCalledWith({
        applicationReference: 'TEST-REF-001'
      })

      // Verify exemption-dynamics-queue collection is called for updateOne
      const calls = mockServer.db.collection.mock.calls
      expect(calls.some((call) => call[0] === 'exemption-dynamics-queue')).toBe(
        true
      )
      expect(mockWreckPost).toHaveBeenCalledWith(
        'https://localhost/api/data/v9.2/exemptions',
        expect.objectContaining({
          payload: {
            contactid: 'test-contact-id',
            projectName: 'Test Project',
            reference: 'TEST-REF-001',
            type: EXEMPTION_TYPE.EXEMPT_ACTIVITY,
            applicationUrl: 'http://localhost/view-details/123',
            applicantOrganisationId: 'test-org-id',
            beneficiaryOrganisationId: 'test-org-id',
            status: EXEMPTION_STATUS.SUBMITTED,
            marinePlanAreas: []
          },
          headers: {
            Authorization: 'Bearer test-access-token',
            'Content-Type': 'application/json'
          }
        })
      )
    })

    it('should not send applicant organisation id if not present', async () => {
      mockServer.db
        .collection()
        .findOne.mockResolvedValue({ ...mockExemption, organisation: null })

      await sendExemptionToDynamics(mockServer, mockAccessToken, mockQueueItem)

      expect(
        mockWreckPost.mock.calls[0][1].payload.applicantOrganisationId
      ).toBeUndefined()
      expect(
        mockWreckPost.mock.calls[0][1].payload.beneficiaryOrganisationId
      ).toBeUndefined()
    })

    it('should send beneficiary organisation id when user is not employee', async () => {
      const exemptionWithBeneficiary = {
        ...mockExemption,
        organisation: {
          id: 'test-beneficiary-org-id',
          userRelationshipType: 'Non-Employee'
        }
      }
      mockServer.db
        .collection()
        .findOne.mockResolvedValue(exemptionWithBeneficiary)

      await sendExemptionToDynamics(mockServer, mockAccessToken, mockQueueItem)

      const payload = mockWreckPost.mock.calls[0][1].payload
      expect(payload.beneficiaryOrganisationId).toBe('test-beneficiary-org-id')
      expect(payload.applicantOrganisationId).toBeUndefined()
    })

    it('should send applicant organisation id when user is employee', async () => {
      const exemptionWithEmployee = {
        ...mockExemption,
        organisation: {
          id: 'test-applicant-org-id',
          userRelationshipType: 'Employee'
        }
      }
      mockServer.db
        .collection()
        .findOne.mockResolvedValue(exemptionWithEmployee)

      await sendExemptionToDynamics(mockServer, mockAccessToken, mockQueueItem)

      expect(mockWreckPost).toHaveBeenCalledWith(
        'https://localhost/api/data/v9.2/exemptions',
        expect.objectContaining({
          payload: expect.objectContaining({
            applicantOrganisationId: 'test-applicant-org-id',
            beneficiaryOrganisationId: 'test-applicant-org-id'
          })
        })
      )
    })

    it('should correctly send marine plan area details', async () => {
      const mockMarinePlanAreas = ['North east inshore', 'North west offshore']

      const exemptionWithMarinePlanAreas = {
        ...mockExemption,
        marinePlanAreas: mockMarinePlanAreas
      }

      mockServer.db
        .collection()
        .findOne.mockResolvedValue(exemptionWithMarinePlanAreas)

      await sendExemptionToDynamics(mockServer, mockAccessToken, mockQueueItem)

      const payload = mockWreckPost.mock.calls[0][1].payload
      expect(payload.marinePlanAreas).toEqual(mockMarinePlanAreas)
    })

    it('should not send organisation id fields when organisation is undefined', async () => {
      const exemptionWithoutOrgs = {
        ...mockExemption,
        organisation: undefined
      }
      mockServer.db.collection().findOne.mockResolvedValue(exemptionWithoutOrgs)

      await sendExemptionToDynamics(mockServer, mockAccessToken, mockQueueItem)

      const payload = mockWreckPost.mock.calls[0][1].payload
      expect(payload.applicantOrganisationId).toBeUndefined()
      expect(payload.beneficiaryOrganisationId).toBeUndefined()
    })

    it('should throw error if request fails', async () => {
      mockServer.db.collection().findOne.mockResolvedValue(mockExemption)
      mockWreckPost.mockImplementation(function () {
        throw new Error('Dynamics API error')
      })

      await expect(
        sendExemptionToDynamics(mockServer, mockAccessToken, mockQueueItem)
      ).rejects.toThrow('Dynamics API error')
    })

    it('should throw error if response status is not 202', async () => {
      mockServer.db.collection().findOne.mockResolvedValue(mockExemption)
      mockWreckPost.mockResolvedValue({
        payload: { error: 'Bad Request' },
        res: { statusCode: 400 }
      })

      await expect(
        sendExemptionToDynamics(mockServer, mockAccessToken, mockQueueItem)
      ).rejects.toThrow('Dynamics API returned status 400')
    })

    it('should throw error if exemption not found', async () => {
      mockServer.db.collection().findOne.mockResolvedValue(null)

      await expect(
        sendExemptionToDynamics(mockServer, mockAccessToken, mockQueueItem)
      ).rejects.toThrow(
        'Exemption not found for applicationReference: TEST-REF-001'
      )
    })
  })
})
