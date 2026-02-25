import { getDynamicsAccessToken } from './get-access-token.js'
import { expect, vi } from 'vitest'
import { config } from '../../../../config.js'
import Wreck from '@hapi/wreck'

vi.mock('../../../../config.js')
vi.mock('@hapi/wreck')

describe('getDynamicsAccessToken', () => {
  const mockWreckPost = vi.mocked(Wreck.post).mockResolvedValue({
    payload: Buffer.from(JSON.stringify({ access_token: 'test_token' }))
  })

  beforeEach(() => {
    config.get.mockReturnValue({
      exemptions: {
        clientId: 'exemption-client-id',
        clientSecret: 'exemption-client-secret',
        scope: 'exemption-scope'
      },
      contactDetails: {
        clientId: 'contactDetails-client-id',
        clientSecret: 'contactDetails-client-secret',
        scope: 'contactDetails-scope'
      },
      tokenUrl: 'https://localhost/oauth2/token'
    })
  })

  it('exemptions - should get token with correct params', async () => {
    const result = await getDynamicsAccessToken({ type: 'exemptions' })
    expect(result).toBe('test_token')
    expect(mockWreckPost).toHaveBeenCalledWith(
      'https://localhost/oauth2/token',
      expect.objectContaining({
        payload:
          'client_id=exemption-client-id&client_secret=exemption-client-secret&grant_type=client_credentials&scope=exemption-scope',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
    )
  })

  it('contact details - should get token with correct params', async () => {
    const result = await getDynamicsAccessToken({ type: 'contactDetails' })
    expect(result).toBe('test_token')
    expect(mockWreckPost).toHaveBeenCalledWith(
      'https://localhost/oauth2/token',
      expect.objectContaining({
        payload:
          'client_id=contactDetails-client-id&client_secret=contactDetails-client-secret&grant_type=client_credentials&scope=contactDetails-scope',
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

    await expect(
      getDynamicsAccessToken({ type: 'exemptions' })
    ).rejects.toThrow('Network error')
  })

  it('should throw error if response does not contain access_token', async () => {
    mockWreckPost.mockReturnValue({
      payload: Buffer.from('{}')
    })
    await expect(
      getDynamicsAccessToken({ type: 'exemptions' })
    ).rejects.toThrow('Dynamics token request failed')
  })

  it('should throw error with Dynamics error description when token request fails', async () => {
    const mockError = new Error('Response Error: 400 Bad Request')

    mockWreckPost.mockImplementation(function () {
      throw mockError
    })

    await expect(
      getDynamicsAccessToken({ type: 'exemptions' })
    ).rejects.toThrow('Response Error: 400 Bad Request')
  })
})
