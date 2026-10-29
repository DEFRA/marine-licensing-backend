import { vi } from 'vitest'
import Wreck from '@hapi/wreck'
import { config } from '../../../../../config.js'
import { sendUpdateExemptionToDynamics } from './send-update-exemption.js'

vi.mock('../../../../../config.js')
vi.mock('@hapi/wreck')
vi.mock('../../logging/logger.js', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }))
}))

describe('sendUpdateExemptionToDynamics', () => {
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
    applicationReferenceNumber: 'TEST-REF-001'
  }

  const mockExemption = {
    _id: '123',
    marinePlanAreas: ['North east inshore'],
    coastalOperationsAreas: ['North']
  }

  const mockAccessToken = 'test-access-token'

  beforeEach(() => {
    mockWreckPost.mockResolvedValue({
      payload: { id: 'dynamics-record-id' },
      res: { statusCode: 202 }
    })
  })

  it('should send update data to Dynamics with correct payload and headers', async () => {
    mockServer.db.collection().findOne.mockResolvedValue(mockExemption)

    const result = await sendUpdateExemptionToDynamics(
      mockServer,
      mockAccessToken,
      mockQueueItem
    )

    expect(result).toEqual({ id: 'dynamics-record-id' })
    expect(mockWreckPost).toHaveBeenCalledWith(
      'https://localhost/api/data/v9.2/exemptions/update',
      expect.objectContaining({
        payload: {
          reference: 'TEST-REF-001',
          marinePlanAreas: ['North east inshore'],
          coastalOperationsAreas: ['North']
        },
        headers: {
          Authorization: 'Bearer test-access-token',
          'Content-Type': 'application/json'
        }
      })
    )
  })

  it('should default marinePlanAreas and coastalOperationsAreas to empty arrays when absent', async () => {
    mockServer.db.collection().findOne.mockResolvedValue({
      ...mockExemption,
      marinePlanAreas: undefined,
      coastalOperationsAreas: undefined
    })

    await sendUpdateExemptionToDynamics(
      mockServer,
      mockAccessToken,
      mockQueueItem
    )

    const payload = mockWreckPost.mock.calls[0][1].payload
    expect(payload.marinePlanAreas).toEqual([])
    expect(payload.coastalOperationsAreas).toEqual([])
  })

  it('should throw error if exemption not found', async () => {
    mockServer.db.collection().findOne.mockResolvedValue(null)

    await expect(
      sendUpdateExemptionToDynamics(mockServer, mockAccessToken, mockQueueItem)
    ).rejects.toThrow(
      'Exemption not found for applicationReference: TEST-REF-001'
    )
  })

  it('should throw error if request fails', async () => {
    mockServer.db.collection().findOne.mockResolvedValue(mockExemption)
    mockWreckPost.mockImplementation(function () {
      throw new Error('Dynamics API error')
    })

    await expect(
      sendUpdateExemptionToDynamics(mockServer, mockAccessToken, mockQueueItem)
    ).rejects.toThrow('Dynamics API error')
  })

  it('should throw error if response status is not 202', async () => {
    mockServer.db.collection().findOne.mockResolvedValue(mockExemption)
    mockWreckPost.mockResolvedValue({
      payload: { error: 'Bad Request' },
      res: { statusCode: 400 }
    })

    await expect(
      sendUpdateExemptionToDynamics(mockServer, mockAccessToken, mockQueueItem)
    ).rejects.toThrow('Dynamics API returned status 400')
  })

  it('should not set a timeout on the exemption update POST', async () => {
    mockServer.db.collection().findOne.mockResolvedValue(mockExemption)

    await sendUpdateExemptionToDynamics(
      mockServer,
      mockAccessToken,
      mockQueueItem
    )

    expect(mockWreckPost.mock.calls[0][1]).not.toHaveProperty('timeout')
  })
})
