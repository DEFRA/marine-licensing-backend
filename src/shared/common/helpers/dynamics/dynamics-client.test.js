import { expect, vi } from 'vitest'
import Wreck from '@hapi/wreck'
import { config } from '../../../../config.js'
import { sendToDynamics } from './dynamics-client.js'
import {
  EXEMPTION_STATUS,
  EXEMPTION_TYPE
} from '../../../../exemptions/constants/exemption.js'
import {
  DYNAMICS_REQUEST_ACTIONS,
  DYNAMICS_QUEUE_TYPES
} from '../../constants/request-queue.js'

vi.mock('../../../../config.js')
vi.mock('@hapi/wreck')

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))
vi.mock('../../helpers/logging/logger.js', () => ({
  createLogger: vi.fn(() => mockLogger)
}))

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
          updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 })
        })
      }
    }
    config.get.mockImplementation(function (value) {
      if (value === 'dynamics') {
        return {
          projects: {
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            scope: 'test-scope',
            maxRetries: 3
          },
          exemptions: {
            apiUrl: 'https://localhost/api/data/v9.2',
            withdrawUrl: 'https://localhost/api/data/v9.2',
            updateUrl: 'https://localhost/api/data/v9.2/exemptions/update'
          },
          marineLicences: {
            apiUrl: 'https://localhost/api/data/v9.2/marine-licences',
            httpTimeoutMs: 120_000
          },
          tokenUrl: 'https://localhost/oauth2/token'
        }
      }
      if (value === 'backendGatewayUrl') {
        return 'http://localhost:3001'
      }
      return 'http://localhost'
    })
  })

  describe('sendToDynamics', () => {
    const mockQueueItem = {
      applicationReferenceNumber: 'TEST-REF-001',
      action: DYNAMICS_REQUEST_ACTIONS.SUBMIT
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

    it('should send correctly call function to send a consultation response', async () => {
      await sendToDynamics(mockServer, mockAccessToken, {
        applicationReferenceNumber: 'MLA/2026/00001',
        action: DYNAMICS_REQUEST_ACTIONS.SEND_CONSULTATION_RESPONSE,
        type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE,
        organisationId: 'test-org-id',
        response: 'No objection'
      })

      expect(mockWreckPost).toHaveBeenCalledWith(
        'https://localhost/api/data/v9.2/marine-licences',
        expect.objectContaining({
          payload: expect.objectContaining({
            action: DYNAMICS_REQUEST_ACTIONS.SEND_CONSULTATION_RESPONSE
          })
        })
      )
      expect(mockServer.db.collection().findOne).not.toHaveBeenCalled()
    })

    it('should send correctly call function to Submit', async () => {
      mockServer.db.collection().findOne.mockResolvedValue(mockExemption)

      const result = await sendToDynamics(
        mockServer,
        mockAccessToken,
        mockQueueItem
      )

      expect(result).toEqual({ id: 'dynamics-record-id' })
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
            status: EXEMPTION_STATUS.SUBMITTED,
            coastalOperationsAreas: [],
            marinePlanAreas: []
          },
          headers: {
            Authorization: 'Bearer test-access-token',
            'Content-Type': 'application/json'
          }
        })
      )
    })

    it('should send correctly call function to Withdraw', async () => {
      mockServer.db.collection().findOne.mockResolvedValue(mockExemption)

      const result = await sendToDynamics(mockServer, mockAccessToken, {
        ...mockQueueItem,
        action: DYNAMICS_REQUEST_ACTIONS.WITHDRAW
      })

      expect(result).toEqual({ id: 'dynamics-record-id' })
      expect(mockWreckPost).toHaveBeenCalledWith(
        'https://localhost/api/data/v9.2',
        expect.objectContaining({
          payload: { reference: 'TEST-REF-001', status: 'WITHDRAWN' },
          headers: {
            Authorization: 'Bearer test-access-token',
            'Content-Type': 'application/json'
          }
        })
      )
    })

    it('should route to sendUpdateExemptionToDynamics when action is update', async () => {
      const mockExemptionForUpdate = {
        _id: '123',
        marinePlanAreas: ['North east inshore'],
        coastalOperationsAreas: ['North']
      }
      mockServer.db
        .collection()
        .findOne.mockResolvedValue(mockExemptionForUpdate)

      const result = await sendToDynamics(mockServer, mockAccessToken, {
        ...mockQueueItem,
        action: DYNAMICS_REQUEST_ACTIONS.UPDATE
      })

      expect(result).toEqual({ id: 'dynamics-record-id' })
      expect(mockWreckPost).toHaveBeenCalledWith(
        'https://localhost/api/data/v9.2/exemptions/update',
        expect.objectContaining({
          payload: {
            reference: 'TEST-REF-001',
            marinePlanAreas: ['North east inshore'],
            coastalOperationsAreas: ['North']
          }
        })
      )
    })

    it('should route to sendMarineLicenceToDynamics when type is marineLicence', async () => {
      const mockMarineLicence = {
        _id: 'ml-123',
        contactId: 'test-contact-id',
        projectName: 'Test Marine Project',
        organisation: null
      }

      mockServer.db.collection().findOne.mockResolvedValue(mockMarineLicence)

      const result = await sendToDynamics(mockServer, mockAccessToken, {
        ...mockQueueItem,
        type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE,
        applicationReferenceNumber: 'MLA/2025/00001'
      })

      expect(result).toEqual({ id: 'dynamics-record-id' })
      expect(mockServer.db.collection).toHaveBeenCalledWith('marine-licences')
      expect(mockWreckPost).toHaveBeenCalledWith(
        'https://localhost/api/data/v9.2/marine-licences',
        expect.any(Object)
      )
    })

    it('should route a marine licence withdrawal to the shared withdraw endpoint', async () => {
      const result = await sendToDynamics(mockServer, mockAccessToken, {
        ...mockQueueItem,
        type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE,
        action: DYNAMICS_REQUEST_ACTIONS.WITHDRAW,
        applicationReferenceNumber: 'MLA/2026/11883'
      })

      expect(result).toEqual({ id: 'dynamics-record-id' })
      expect(mockWreckPost).toHaveBeenCalledWith(
        'https://localhost/api/data/v9.2',
        expect.objectContaining({
          payload: { reference: 'MLA/2026/11883', status: 'WITHDRAWN' }
        })
      )
    })
  })
})
