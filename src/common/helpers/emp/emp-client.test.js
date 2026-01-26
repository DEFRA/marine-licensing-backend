import { expect, vi } from 'vitest'

import { config } from '../../../config.js'
import { sendExemptionToEmp } from './emp-client.js'
import { addFeatures } from '@esri/arcgis-rest-feature-service'

vi.mock('../../../config.js')
vi.mock('@esri/arcgis-rest-feature-service')

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
      whoExemptionIsFor: 'Test User'
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
          coordinatesEntry: 'multiple',
          coordinateSystem: 'osgb36',
          coordinates: [
            {
              eastings: '400780',
              northings: '087555'
            },
            {
              eastings: '400604',
              northings: '087356'
            }
          ]
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

    it('should send exemption data to EMP successfully', async () => {
      vi.mocked(addFeatures).mockResolvedValue({
        addResults: [
          {
            success: true,
            objectId: 'emp-record-id'
          }
        ]
      })
      mockServer.db.collection().findOne.mockResolvedValue(mockExemption)

      const result = await sendExemptionToEmp(mockServer, mockQueueItem)

      expect(result.objectId).toEqual('emp-record-id')
      expect(mockServer.db.collection).toHaveBeenCalledWith('exemptions')
      expect(mockServer.db.collection().findOne).toHaveBeenCalledWith({
        applicationReference: 'TEST-REF-001'
      })

      // Verify exemption-emp-queue collection is called for updateOne
      const calls = mockServer.db.collection.mock.calls
      expect(calls.some((call) => call[0] === 'exemption-emp-queue')).toBe(true)

      expect(addFeatures).toHaveBeenCalledWith({
        features: expect.any(Object),
        url: 'https://localhost/api/addFeatures',
        params: { token: 'test-api-key' }
      })
    })

    it('should throw error if EMP request fails', async () => {
      mockServer.db.collection().findOne.mockResolvedValue(mockExemption)
      vi.mocked(addFeatures).mockResolvedValue({
        addResults: [
          {
            success: false,
            error: { code: 400, description: 'Error adding feature' }
          }
        ]
      })

      await expect(
        sendExemptionToEmp(mockServer, mockQueueItem)
      ).rejects.toThrow('EMP addFeatures failed: Error adding feature')
    })

    it('should throw error if EMP does not return an objectId for the new feature', async () => {
      mockServer.db.collection().findOne.mockResolvedValue(mockExemption)
      vi.mocked(addFeatures).mockResolvedValue({
        addResults: [{ success: true, objectId: undefined }]
      })
      await expect(
        sendExemptionToEmp(mockServer, mockQueueItem)
      ).rejects.toThrow('EMP addFeatures failed:')
    })

    it('should throw error if exemption not found', async () => {
      mockServer.db.collection().findOne.mockResolvedValue(null)

      await expect(
        sendExemptionToEmp(mockServer, mockQueueItem)
      ).rejects.toThrow(
        '#findExemptionByApplicationReference not found for TEST-REF-001'
      )
    })

    it('should throw error if no coordinates are passed to transformExemptionToEmpRequest', async () => {
      mockServer.db.collection().findOne.mockResolvedValue({
        ...mockExemption,
        siteDetails: [
          {
            activityDates: {
              start: '2024-01-01',
              end: '2024-12-31'
            },
            coordinatesEntry: 'multiple',
            coordinateSystem: 'osgb36'
          }
        ]
      })
      await expect(
        sendExemptionToEmp(mockServer, mockQueueItem)
      ).rejects.toThrow('EMP addFeatures failed: Coordinates missing')
    })
  })
})
