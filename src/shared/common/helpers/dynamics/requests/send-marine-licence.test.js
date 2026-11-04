import { vi } from 'vitest'
import Wreck from '@hapi/wreck'
import { config } from '../../../../../config.js'
import { sendMarineLicenceToDynamics } from './send-marine-licence.js'

vi.mock('../../../../../config.js')
vi.mock('@hapi/wreck')
vi.mock('../../logging/logger.js', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }))
}))

describe('sendMarineLicenceToDynamics', () => {
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
    _id: 'queue-item-id',
    applicationReferenceNumber: 'MLA/2025/00001'
  }

  const mockMarineLicence = {
    _id: 'ml-123',
    contactId: 'test-contact-id',
    projectName: 'Test Marine Project',
    organisation: { id: 'test-org-id' },
    feeEstimate: { feeBand: '2A' }
  }

  const mockAccessToken = 'test-access-token'

  beforeEach(() => {
    mockWreckPost.mockResolvedValue({
      payload: { id: 'dynamics-record-id' },
      res: { statusCode: 202 }
    })
  })

  it('should send marine licence data to Dynamics with correct payload and headers', async () => {
    mockServer.db.collection().findOne.mockResolvedValue(mockMarineLicence)

    const result = await sendMarineLicenceToDynamics(
      mockServer,
      mockAccessToken,
      mockQueueItem
    )

    expect(result).toEqual({ id: 'dynamics-record-id' })
    expect(mockServer.db.collection).toHaveBeenCalledWith('marine-licences')
    expect(mockWreckPost).toHaveBeenCalledWith(
      'https://localhost/api/data/v9.2/marine-licences',
      expect.objectContaining({
        payload: {
          contactid: 'test-contact-id',
          marineLicenceId: 'ml-123',
          feeBand: '2A',
          projectName: 'Test Marine Project',
          projectBackground: null,
          reference: 'MLA/2025/00001',
          applicantOrganisationId: 'test-org-id',
          applicationUrl:
            'http://localhost/marine-licence/redaction/MLA-2025-00001',
          coordinatesCsvUrl:
            'http://localhost:3001/public/marine-licence/ml-123/generate-coordinates-csv',
          waterFrameworkDirective: {
            nauticalMile: null,
            excludedActivities: null,
            documentUrl: null,
            fileName: null
          },
          marinePlanAreas: [],
          coastalOperationsAreas: [],
          publicRegister: {
            withholdConsent: null,
            reason: null
          },
          status: 'SUBMITTED'
        },
        headers: {
          Authorization: 'Bearer test-access-token',
          'Content-Type': 'application/json'
        }
      })
    )
  })

  it('should send marine licence with fallback for feeband', async () => {
    mockServer.db.collection().findOne.mockResolvedValueOnce({
      ...mockMarineLicence,
      feeEstimate: {}
    })

    await sendMarineLicenceToDynamics(
      mockServer,
      mockAccessToken,
      mockQueueItem
    )

    expect(mockWreckPost).toHaveBeenCalledWith(
      'https://localhost/api/data/v9.2/marine-licences',
      expect.objectContaining({
        payload: {
          contactid: 'test-contact-id',
          marineLicenceId: 'ml-123',
          feeBand: '2A',
          projectName: 'Test Marine Project',
          projectBackground: null,
          reference: 'MLA/2025/00001',
          applicantOrganisationId: 'test-org-id',
          applicationUrl:
            'http://localhost/marine-licence/redaction/MLA-2025-00001',
          coordinatesCsvUrl:
            'http://localhost:3001/public/marine-licence/ml-123/generate-coordinates-csv',
          waterFrameworkDirective: {
            nauticalMile: null,
            excludedActivities: null,
            documentUrl: null,
            fileName: null
          },
          marinePlanAreas: [],
          coastalOperationsAreas: [],
          publicRegister: {
            withholdConsent: null,
            reason: null
          },
          status: 'SUBMITTED'
        },
        headers: {
          Authorization: 'Bearer test-access-token',
          'Content-Type': 'application/json'
        }
      })
    )
  })

  it('should include projectBackground when present on the marine licence', async () => {
    mockServer.db.collection().findOne.mockResolvedValue({
      ...mockMarineLicence,
      projectBackground: 'Maintenance of navigation channel'
    })

    await sendMarineLicenceToDynamics(
      mockServer,
      mockAccessToken,
      mockQueueItem
    )

    expect(mockWreckPost.mock.calls[0][1].payload).toEqual(
      expect.objectContaining({
        projectBackground: 'Maintenance of navigation channel'
      })
    )
  })

  it('should include waterFrameworkDirective answers and document fields when present', async () => {
    mockServer.db.collection().findOne.mockResolvedValue({
      ...mockMarineLicence,
      waterFrameworkDirective: {
        nauticalMile: 'yes',
        excludedActivities: 'no',
        uploadedFile: { filename: 'wfd-assessment.docx' },
        s3Location: {
          s3Bucket: 'mmo-uploads',
          s3Key: 'exemptions/file-id'
        }
      }
    })

    await sendMarineLicenceToDynamics(
      mockServer,
      mockAccessToken,
      mockQueueItem
    )

    expect(mockWreckPost.mock.calls[0][1].payload).toEqual(
      expect.objectContaining({
        waterFrameworkDirective: {
          nauticalMile: 'yes',
          excludedActivities: 'no',
          documentUrl:
            'http://localhost:3001/public/marine-licence/ml-123/water-framework-directive/download-url',
          fileName: 'wfd-assessment.docx'
        }
      })
    )
  })

  it('should include partial waterFrameworkDirective answers when incomplete', async () => {
    mockServer.db.collection().findOne.mockResolvedValue({
      ...mockMarineLicence,
      waterFrameworkDirective: {
        nauticalMile: 'yes'
      }
    })

    await sendMarineLicenceToDynamics(
      mockServer,
      mockAccessToken,
      mockQueueItem
    )

    expect(
      mockWreckPost.mock.calls[0][1].payload.waterFrameworkDirective
    ).toEqual({
      nauticalMile: 'yes',
      excludedActivities: null,
      documentUrl: null,
      fileName: null
    })
  })

  it('should include marinePlanAreas and coastalOperationsAreas when present on the marine licence', async () => {
    mockServer.db.collection().findOne.mockResolvedValue({
      ...mockMarineLicence,
      marinePlanAreas: [{ name: 'South Marine Plan Area' }],
      coastalOperationsAreas: [{ name: 'Coastal Ops Area 1' }]
    })

    await sendMarineLicenceToDynamics(
      mockServer,
      mockAccessToken,
      mockQueueItem
    )

    expect(mockWreckPost.mock.calls[0][1].payload).toEqual(
      expect.objectContaining({
        marinePlanAreas: [{ name: 'South Marine Plan Area' }],
        coastalOperationsAreas: [{ name: 'Coastal Ops Area 1' }]
      })
    )
  })

  it('should include publicRegister when present on the marine licence', async () => {
    mockServer.db.collection().findOne.mockResolvedValue({
      ...mockMarineLicence,
      publicRegister: {
        withholdConsent: 'yes',
        reason:
          'Ascisco subito adipisci statim aggredior virtus pariatur torqueo curatio.'
      }
    })

    await sendMarineLicenceToDynamics(
      mockServer,
      mockAccessToken,
      mockQueueItem
    )

    expect(mockWreckPost.mock.calls[0][1].payload).toEqual(
      expect.objectContaining({
        publicRegister: {
          withholdConsent: 'yes',
          reason:
            'Ascisco subito adipisci statim aggredior virtus pariatur torqueo curatio.'
        }
      })
    )
  })

  it('should include publicRegister with null reason when withholdConsent is no', async () => {
    mockServer.db.collection().findOne.mockResolvedValue({
      ...mockMarineLicence,
      publicRegister: {
        withholdConsent: 'no'
      }
    })

    await sendMarineLicenceToDynamics(
      mockServer,
      mockAccessToken,
      mockQueueItem
    )

    expect(mockWreckPost.mock.calls[0][1].payload.publicRegister).toEqual({
      withholdConsent: 'no',
      reason: null
    })
  })

  it('should omit applicantOrganisationId when no organisation present', async () => {
    mockServer.db
      .collection()
      .findOne.mockResolvedValue({ ...mockMarineLicence, organisation: null })

    await sendMarineLicenceToDynamics(
      mockServer,
      mockAccessToken,
      mockQueueItem
    )

    expect(
      mockWreckPost.mock.calls[0][1].payload.applicantOrganisationId
    ).toBeUndefined()
  })

  it('should throw error if marine licence not found', async () => {
    mockServer.db.collection().findOne.mockResolvedValue(null)

    await expect(
      sendMarineLicenceToDynamics(mockServer, mockAccessToken, mockQueueItem)
    ).rejects.toThrow(
      'Marine licence not found for applicationReference: MLA/2025/00001'
    )
  })

  it('should throw error if response status is not 202', async () => {
    mockServer.db.collection().findOne.mockResolvedValue(mockMarineLicence)
    mockWreckPost.mockResolvedValue({
      payload: { error: 'Bad Request' },
      res: { statusCode: 400 }
    })

    await expect(
      sendMarineLicenceToDynamics(mockServer, mockAccessToken, mockQueueItem)
    ).rejects.toThrow('Dynamics API returned status 400')
  })

  it('should time out the POST after the configured marine licence timeout', async () => {
    mockServer.db.collection().findOne.mockResolvedValue(mockMarineLicence)

    await sendMarineLicenceToDynamics(
      mockServer,
      mockAccessToken,
      mockQueueItem
    )

    expect(mockWreckPost).toHaveBeenCalledWith(
      'https://localhost/api/data/v9.2/marine-licences',
      expect.objectContaining({ timeout: 120_000 })
    )
  })
})
