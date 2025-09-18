import { expect, jest } from '@jest/globals'
import Wreck from '@hapi/wreck'

import { config } from '../../../config.js'
import {
  getDynamicsAccessToken,
  sendExemptionToDynamics
} from './dynamics-client.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'

jest.mock('../../../config.js')
jest.mock('@hapi/wreck')

describe('Dynamics Client', () => {
  let mockServer
  const mockWreckPost = jest.mocked(Wreck.post).mockResolvedValue({
    payload: Buffer.from(JSON.stringify({ access_token: 'test_token' }))
  })

  beforeEach(() => {
    mockServer = {
      db: {
        collection: jest.fn().mockReturnValue({
          findOne: jest.fn(),
          updateOne: jest.fn()
        })
      }
    }
    config.get.mockImplementation((value) =>
      value === 'dynamics'
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
    )

    jest.clearAllMocks()
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
      mockWreckPost.mockImplementation(() => {
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

      mockWreckPost.mockImplementation(() => {
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
      reference: 'TEST-REF-001'
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
      expect(mockServer.db.collection().updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: '123'
        }),
        {
          $set: { status: 'in_progress', updatedAt: expect.any(Date) }
        }
      )
      expect(mockWreckPost).toHaveBeenCalledWith(
        'https://localhost/api/data/v9.2/exemptions',
        expect.objectContaining({
          payload: {
            contactid: 'test-contact-id',
            projectName: 'Test Project',
            reference: 'TEST-REF-001',
            type: 'EXEMPT_ACTIVITY',
            applicationUrl: 'http://localhost/view-details/123',
            status: EXEMPTION_STATUS.SUBMITTED
          },
          headers: {
            Authorization: 'Bearer test-access-token',
            'Content-Type': 'application/json'
          }
        })
      )
    })

    it('should throw error if request fails', async () => {
      mockServer.db.collection().findOne.mockResolvedValue(mockExemption)
      mockWreckPost.mockImplementation(() => {
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
