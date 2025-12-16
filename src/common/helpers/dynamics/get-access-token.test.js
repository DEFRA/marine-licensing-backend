import { getDynamicsAccessToken } from './get-access-token.js'
import { expect, vi } from 'vitest'
import { config } from '../../../config.js'
import Wreck from '@hapi/wreck'

vi.mock('../../../config.js')
vi.mock('@hapi/wreck')

describe('getDynamicsAccessToken', () => {
  const mockWreckPost = vi.mocked(Wreck.post).mockResolvedValue({
    payload: Buffer.from(JSON.stringify({ access_token: 'test_token' }))
  })

  beforeEach(() => {
    config.get.mockImplementation(function (value) {
      return value === 'dynamics'
        ? {
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            scope: {
              exemption: 'exemptionScope',
              contactDetails: 'contactDetailsScope'
            },
            maxRetries: 3,
            retryDelayMs: 60000,
            tokenUrl: 'https://localhost/oauth2/token',
            apiUrl: { exemption: 'https://localhost/api/data/v9.2' }
          }
        : 'http://localhost'
    })
  })

  it('should make POST request to config URL with client credentials', async () => {
    const result = await getDynamicsAccessToken({ scopeType: 'exemption' })

    expect(result).toBe('test_token')
    expect(mockWreckPost).toHaveBeenCalledWith(
      'https://localhost/oauth2/token',
      expect.objectContaining({
        payload:
          'client_id=test-client-id&client_secret=test-client-secret&grant_type=client_credentials&scope=exemptionScope',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
    )
  })

  it('should use scope for contact details, if specified', async () => {
    await getDynamicsAccessToken({ scopeType: 'contactDetails' })
    expect(mockWreckPost.mock.calls[0][1].payload).toEqual(
      'client_id=test-client-id&client_secret=test-client-secret&grant_type=client_credentials&scope=contactDetailsScope'
    )
  })

  it('should throw error if request fails', async () => {
    mockWreckPost.mockImplementation(function () {
      throw new Error('Network error')
    })

    await expect(
      getDynamicsAccessToken({ scopeType: 'exemption' })
    ).rejects.toThrow('Network error')
  })

  it('should throw error if response does not contain access_token', async () => {
    mockWreckPost.mockReturnValue({
      payload: Buffer.from('{}')
    })
    await expect(
      getDynamicsAccessToken({ scopeType: 'exemption' })
    ).rejects.toThrow('Dynamics token request failed')
  })

  it('should throw error with Dynamics error description when token request fails', async () => {
    const mockError = new Error('Response Error: 400 Bad Request')

    mockWreckPost.mockImplementation(function () {
      throw mockError
    })

    await expect(
      getDynamicsAccessToken({ scopeType: 'exemption' })
    ).rejects.toThrow('Response Error: 400 Bad Request')
  })
})
