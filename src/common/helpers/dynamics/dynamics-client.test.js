import { expect, jest } from '@jest/globals'
import Wreck from '@hapi/wreck'

import { config } from '../../../config.js'
import { getDynamicsAccessToken } from './dynamics-client.js'

jest.mock('../../../config.js')
jest.mock('@hapi/wreck')

describe('Dynamics Client', () => {
  let mockServer
  const mockWreckPost = jest.mocked(Wreck.post).mockResolvedValue({
    payload: {
      access_token: 'test_token'
    }
  })

  beforeEach(() => {
    mockServer = {
      app: {},
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    }

    config.get.mockReturnValue({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      scope: 'test-scope',
      maxRetries: 3,
      retryDelayMs: 60000,
      tokenUrl: 'https://placeholder.dynamics.com/oauth2/token'
    })

    jest.clearAllMocks()
  })

  describe('getDynamicsAccessToken', () => {
    it('should make POST request to config URL with client credentials', async () => {
      const result = await getDynamicsAccessToken(mockServer)

      expect(result).toBe('test_token')
      expect(mockWreckPost).toHaveBeenCalledWith(
        'https://placeholder.dynamics.com/oauth2/token',
        expect.objectContaining({
          payload: expect.objectContaining({ grant_type: 'client_credentials' })
        })
      )
    })

    it('should throw error if request fails', async () => {
      mockWreckPost.mockImplementation(() => {
        throw new Error('Network error')
      })

      await expect(getDynamicsAccessToken(mockServer)).rejects.toThrow(
        'Network error'
      )
    })

    it('should throw error if response does not contain access_token', async () => {
      mockWreckPost.mockReturnValue({ payload: {} })
      await expect(getDynamicsAccessToken(mockServer)).rejects.toThrow(
        'No access_token in response'
      )
    })
  })
})
