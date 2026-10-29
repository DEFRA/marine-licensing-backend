import { vi } from 'vitest'
import Wreck from '@hapi/wreck'
import { config } from '../../../../../config.js'
import { sendExemptionToDynamics } from './send-exemption.js'
import {
  EXEMPTION_STATUS,
  EXEMPTION_TYPE
} from '../../../../../exemptions/constants/exemption.js'

vi.mock('../../../../../config.js')
vi.mock('@hapi/wreck')
vi.mock('../../logging/logger.js', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }))
}))

describe('sendExemptionToDynamics', () => {
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

  it('should not send applicant organisation id if not present', async () => {
    mockServer.db
      .collection()
      .findOne.mockResolvedValue({ ...mockExemption, organisation: null })

    await sendExemptionToDynamics(mockServer, mockAccessToken, mockQueueItem)

    expect(
      mockWreckPost.mock.calls[0][1].payload.applicantOrganisationId
    ).toBeUndefined()
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

  it('should correctly send Coastal Operations area details', async () => {
    const mockCoastalOperationsAreas = ['North', 'South']

    const exemptionWithCoastalOperationsAreas = {
      ...mockExemption,
      coastalOperationsAreas: mockCoastalOperationsAreas
    }

    mockServer.db
      .collection()
      .findOne.mockResolvedValue(exemptionWithCoastalOperationsAreas)

    await sendExemptionToDynamics(mockServer, mockAccessToken, mockQueueItem)

    const payload = mockWreckPost.mock.calls[0][1].payload
    expect(payload.coastalOperationsAreas).toEqual(mockCoastalOperationsAreas)
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

  it('should not set a timeout on the exemption POST', async () => {
    mockServer.db.collection().findOne.mockResolvedValue(mockExemption)

    await sendExemptionToDynamics(mockServer, mockAccessToken, mockQueueItem)

    expect(mockWreckPost.mock.calls[0][1]).not.toHaveProperty('timeout')
  })
})
