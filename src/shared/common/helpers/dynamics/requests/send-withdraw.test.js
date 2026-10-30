import { vi } from 'vitest'
import Wreck from '@hapi/wreck'
import { config } from '../../../../../config.js'
import { sendWithdrawToDynamics } from './send-withdraw.js'
import { DYNAMICS_QUEUE_TYPES } from '../../../constants/request-queue.js'

vi.mock('../../../../../config.js')
vi.mock('@hapi/wreck')
vi.mock('../../logging/logger.js', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }))
}))

describe('sendWithdrawToDynamics', () => {
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

  const mockAccessToken = 'test-access-token'

  beforeEach(() => {
    mockWreckPost.mockResolvedValue({
      payload: { id: 'dynamics-record-id' },
      res: { statusCode: 202 }
    })
  })

  it('should send withdraw data to Dynamics with correct payload and headers', async () => {
    const result = await sendWithdrawToDynamics(
      mockServer,
      mockAccessToken,
      mockQueueItem
    )

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

  it('should throw error if request fails', async () => {
    mockWreckPost.mockImplementation(function () {
      throw new Error('Dynamics API error')
    })

    await expect(
      sendWithdrawToDynamics(mockServer, mockAccessToken, mockQueueItem)
    ).rejects.toThrow('Dynamics API error')
  })

  it('should throw error if response status is not 202', async () => {
    mockWreckPost.mockResolvedValue({
      payload: { error: 'Bad Request' },
      res: { statusCode: 400 }
    })

    await expect(
      sendWithdrawToDynamics(mockServer, mockAccessToken, mockQueueItem)
    ).rejects.toThrow('Dynamics API returned status 400')
  })

  it('should not set a timeout on an exemption withdrawal', async () => {
    await sendWithdrawToDynamics(mockServer, mockAccessToken, mockQueueItem)

    expect(mockWreckPost.mock.calls[0][1]).not.toHaveProperty('timeout')
  })

  it('should time out a marine licence withdrawal after the configured marine licence timeout', async () => {
    await sendWithdrawToDynamics(mockServer, mockAccessToken, {
      ...mockQueueItem,
      type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE
    })

    expect(mockWreckPost).toHaveBeenCalledWith(
      'https://localhost/api/data/v9.2',
      expect.objectContaining({ timeout: 120_000 })
    )
  })
})
