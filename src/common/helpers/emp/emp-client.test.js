import { expect, vi } from 'vitest'

import { config } from '../../../config.js'
import { sendExemptionToEmp } from './emp-client.js'
import * as helpers from './helpers.js'

vi.mock('../../../config.js')
vi.mock('./helpers.js', async () => {
  const actual = await vi.importActual('./helpers.js')
  return {
    ...actual,
    makeEmpRequest: vi.fn()
  }
})

describe('Emp Client', () => {
  let mockServer

  beforeEach(() => {
    mockServer = {
      db: {
        collection: vi.fn().mockReturnValue({
          findOne: vi.fn(),
          updateOne: vi.fn()
        })
      }
    }
    config.get.mockImplementation((value) =>
      value === 'exploreMarinePlanning'
        ? {
            apiUrl: 'https://localhost/api',
            apiKey: 'test-api-key'
          }
        : 'http://localhost'
    )
  })

  describe('sendExemptionToEmp', () => {
    const mockQueueItem = {
      applicationReferenceNumber: 'TEST-REF-001',
      userName: 'Test User'
    }

    const mockExemption = {
      _id: '123',
      contactId: 'test-contact-id',
      projectName: 'Test Project',
      applicationReference: 'TEST-REF-001',
      reference: 'TEST-REF-001',
      submittedAt: '2024-01-01T00:00:00Z',
      organisation: {
        id: 'test-org-id',
        name: 'Test Organisation',
        userRelationshipType: 'Employee'
      },
      siteDetails: [
        {
          activityDates: {
            start: '2024-01-01',
            end: '2024-12-31'
          },
          location: {
            latitude: 50.123,
            longitude: -1.456
          }
        }
      ],
      publicRegister: {
        consent: 'yes'
      },
      mcmsContext: {
        activity: {
          label: 'Test Activity',
          purpose: 'Test Purpose'
        },
        articleCode: 'Article 123',
        pdfDownloadUrl: 'https://example.com/pdf'
      }
    }

    const mockEmpResponse = {
      response: {
        res: { statusCode: 200 }
      },
      data: { id: 'emp-record-id' }
    }

    beforeEach(() => {
      vi.mocked(helpers.makeEmpRequest).mockResolvedValue(mockEmpResponse)
    })

    it('should send exemption data to EMP successfully', async () => {
      mockServer.db.collection().findOne.mockResolvedValue(mockExemption)

      const result = await sendExemptionToEmp(mockServer, mockQueueItem)

      expect(result).toEqual({ id: 'emp-record-id' })
      expect(mockServer.db.collection).toHaveBeenCalledWith('exemptions')
      expect(mockServer.db.collection().findOne).toHaveBeenCalledWith({
        applicationReference: 'TEST-REF-001'
      })

      // Verify exemption-emp-queue collection is called for updateOne
      const calls = mockServer.db.collection.mock.calls
      expect(calls.some((call) => call[0] === 'exemption-emp-queue')).toBe(true)

      // Verify makeEmpRequest was called with correct parameters
      expect(helpers.makeEmpRequest).toHaveBeenCalledWith({
        features: expect.any(Object),
        apiUrl: 'https://localhost/api',
        apiKey: 'test-api-key'
      })
    })

    it('should throw error if request fails', async () => {
      mockServer.db.collection().findOne.mockResolvedValue(mockExemption)
      vi.mocked(helpers.makeEmpRequest).mockRejectedValue(
        new Error('EMP API error')
      )

      await expect(
        sendExemptionToEmp(mockServer, mockQueueItem)
      ).rejects.toThrow('EMP API request failed')
    })

    it('should throw error if response status is not 200', async () => {
      mockServer.db.collection().findOne.mockResolvedValue(mockExemption)
      vi.mocked(helpers.makeEmpRequest).mockResolvedValue({
        response: {
          res: { statusCode: 400 }
        },
        data: { error: 'Bad Request' }
      })

      await expect(
        sendExemptionToEmp(mockServer, mockQueueItem)
      ).rejects.toThrow('EMP API request failed')
    })

    it('should throw error if exemption not found', async () => {
      mockServer.db.collection().findOne.mockResolvedValue(null)

      await expect(
        sendExemptionToEmp(mockServer, mockQueueItem)
      ).rejects.toThrow(
        'Exemption not found for applicationReference: TEST-REF-001'
      )
    })
  })
})
