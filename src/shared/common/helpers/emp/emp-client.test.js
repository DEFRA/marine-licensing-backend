import { expect, vi } from 'vitest'
import { config } from '../../../../config.js'
import {
  sendExemptionToEmp,
  withdrawExemptionFromEmp,
  updateExemptionStatusInEmp
} from './emp-client.js'
import { addFeatures, updateFeatures } from '@esri/arcgis-rest-feature-service'

vi.mock('../../../../config.js')
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
              easting: '400780',
              northing: '087555'
            },
            {
              easting: '400604',
              northing: '087356'
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

      expect(result.objectIds).toEqual(['emp-record-id'])
      expect(mockServer.db.collection).toHaveBeenCalledWith('exemptions')
      expect(mockServer.db.collection().findOne).toHaveBeenCalledWith({
        applicationReference: 'TEST-REF-001'
      })

      expect(mockServer.db.collection().updateOne).not.toHaveBeenCalled()

      expect(addFeatures).toHaveBeenCalledWith({
        features: expect.any(Array),
        url: 'https://localhost/api/addFeatures',
        params: { token: 'test-api-key', rollbackOnFailure: true }
      })
    })

    it('should send one feature per manual circle site and return all objectIds', async () => {
      const circleExemption = {
        ...mockExemption,
        siteDetails: [
          {
            coordinatesType: 'coordinates',
            activityDates: { start: '2024-01-01', end: '2024-12-31' },
            coordinatesEntry: 'single',
            coordinateSystem: 'wgs84',
            coordinates: { latitude: '55.019889', longitude: '-1.399500' },
            circleWidth: '1'
          },
          {
            coordinatesType: 'coordinates',
            activityDates: { start: '2024-01-01', end: '2024-12-31' },
            coordinatesEntry: 'single',
            coordinateSystem: 'wgs84',
            coordinates: { latitude: '55.020000', longitude: '-1.400000' },
            circleWidth: '1'
          }
        ]
      }
      vi.mocked(addFeatures).mockResolvedValue({
        addResults: [
          { success: true, objectId: 'emp-1' },
          { success: true, objectId: 'emp-2' }
        ]
      })
      mockServer.db.collection().findOne.mockResolvedValue(circleExemption)

      const result = await sendExemptionToEmp(mockServer, mockQueueItem)

      expect(result.objectIds).toEqual(['emp-1', 'emp-2'])
      const [call] = vi.mocked(addFeatures).mock.calls
      expect(Array.isArray(call[0].features)).toBe(true)
      expect(call[0].features).toHaveLength(2)
      expect(call[0].params).toEqual({
        token: 'test-api-key',
        rollbackOnFailure: true
      })
    })

    it('should throw if any feature in the batch fails', async () => {
      mockServer.db.collection().findOne.mockResolvedValue(mockExemption)
      vi.mocked(addFeatures).mockResolvedValue({
        addResults: [
          { success: true, objectId: 'emp-1' },
          {
            success: false,
            error: { code: 400, description: 'Second feature failed' }
          }
        ]
      })

      await expect(
        sendExemptionToEmp(mockServer, mockQueueItem)
      ).rejects.toThrow('EMP addFeatures failed: Second feature failed')
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
      ).rejects.toThrow('EMP addFeatures failed: Unknown error')
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

  describe('withdrawExemptionFromEmp', () => {
    const mockWithdrawQueueItem = {
      _id: 'withdraw-queue-id',
      applicationReferenceNumber: 'TEST-REF-001',
      action: 'withdraw'
    }

    it('should update exemption status in EMP successfully', async () => {
      mockServer.db.collection().findOne.mockResolvedValue({
        empFeatureIds: ['emp-object-id']
      })
      vi.mocked(updateFeatures).mockResolvedValue({
        updateResults: [{ success: true, objectId: 'emp-object-id' }]
      })

      const result = await withdrawExemptionFromEmp(
        mockServer,
        mockWithdrawQueueItem
      )

      expect(result.objectIds).toEqual(['emp-object-id'])
      expect(mockServer.db.collection).toHaveBeenCalledWith(
        'exemption-emp-queue'
      )
      expect(updateFeatures).toHaveBeenCalledWith({
        url: 'https://localhost/api/updateFeatures',
        features: [
          {
            attributes: {
              OBJECTID: 'emp-object-id',
              Status: 'Withdrawn'
            }
          }
        ],
        params: { token: 'test-api-key', rollbackOnFailure: true }
      })
    })

    it('should withdraw all features when multiple ids were stored', async () => {
      mockServer.db.collection().findOne.mockResolvedValue({
        empFeatureIds: ['emp-1', 'emp-2', 'emp-3']
      })
      vi.mocked(updateFeatures).mockResolvedValue({
        updateResults: [
          { success: true, objectId: 'emp-1' },
          { success: true, objectId: 'emp-2' },
          { success: true, objectId: 'emp-3' }
        ]
      })

      const result = await withdrawExemptionFromEmp(
        mockServer,
        mockWithdrawQueueItem
      )

      expect(result.objectIds).toEqual(['emp-1', 'emp-2', 'emp-3'])
      const [call] = vi.mocked(updateFeatures).mock.calls
      expect(call[0].features).toHaveLength(3)
      expect(call[0].features[2].attributes).toEqual({
        OBJECTID: 'emp-3',
        Status: 'Withdrawn'
      })
    })

    it('should fall back to legacy empFeatureId on the queue item', async () => {
      mockServer.db.collection().findOne.mockResolvedValue({
        empFeatureId: 'legacy-id'
      })
      vi.mocked(updateFeatures).mockResolvedValue({
        updateResults: [{ success: true, objectId: 'legacy-id' }]
      })

      const result = await withdrawExemptionFromEmp(
        mockServer,
        mockWithdrawQueueItem
      )

      expect(result.objectIds).toEqual(['legacy-id'])
      const [call] = vi.mocked(updateFeatures).mock.calls
      expect(call[0].features).toEqual([
        { attributes: { OBJECTID: 'legacy-id', Status: 'Withdrawn' } }
      ])
    })

    it('should throw error if no objectId found in queue', async () => {
      mockServer.db.collection().findOne.mockResolvedValue(null)

      await expect(
        withdrawExemptionFromEmp(mockServer, mockWithdrawQueueItem)
      ).rejects.toThrow(
        'EMP withdraw failed: no objectId found for TEST-REF-001'
      )

      expect(updateFeatures).not.toHaveBeenCalled()
    })

    it('should throw error if prior queue item has empty empFeatureIds and no legacy empFeatureId', async () => {
      mockServer.db.collection().findOne.mockResolvedValue({
        empFeatureIds: [],
        empFeatureId: null
      })

      await expect(
        withdrawExemptionFromEmp(mockServer, mockWithdrawQueueItem)
      ).rejects.toThrow(
        'EMP withdraw failed: no objectId found for TEST-REF-001'
      )

      expect(updateFeatures).not.toHaveBeenCalled()
    })

    it('should throw error if updateFeatures returns failure', async () => {
      mockServer.db.collection().findOne.mockResolvedValue({
        empFeatureIds: ['emp-object-id']
      })
      vi.mocked(updateFeatures).mockResolvedValue({
        updateResults: [
          {
            success: false,
            error: { code: 400, description: 'Update failed' }
          }
        ]
      })

      await expect(
        withdrawExemptionFromEmp(mockServer, mockWithdrawQueueItem)
      ).rejects.toThrow('EMP updateFeatures failed: Update failed')
    })

    it('should throw error if updateFeatures throws an exception', async () => {
      mockServer.db.collection().findOne.mockResolvedValue({
        empFeatureIds: ['emp-object-id']
      })
      vi.mocked(updateFeatures).mockRejectedValue(new Error('Network timeout'))

      await expect(
        withdrawExemptionFromEmp(mockServer, mockWithdrawQueueItem)
      ).rejects.toThrow('EMP updateFeatures failed: Network timeout')
    })
  })

  describe('updateExemptionStatusInEmp', () => {
    const mockStatusQueueItem = {
      _id: 'status-queue-id',
      applicationReferenceNumber: 'TEST-REF-001',
      action: 'update-status'
    }

    const respondWith = ({ empFeatureIds, status }) => {
      mockServer.db
        .collection()
        .findOne.mockResolvedValueOnce(empFeatureIds ? { empFeatureIds } : null)
        .mockResolvedValueOnce(status ? { status } : null)
    }

    it.each([
      ['SCHEDULED', 'Scheduled'],
      ['ACTIVE', 'Active'],
      ['EXPIRED', 'Expired']
    ])('pushes a %s exemption to EMP as %s', async (status, expected) => {
      respondWith({ empFeatureIds: ['emp-object-id'], status })
      vi.mocked(updateFeatures).mockResolvedValue({
        updateResults: [{ success: true, objectId: 'emp-object-id' }]
      })

      await updateExemptionStatusInEmp(mockServer, mockStatusQueueItem)

      const [call] = vi.mocked(updateFeatures).mock.calls
      expect(call[0].features).toEqual([
        { attributes: { OBJECTID: 'emp-object-id', Status: expected } }
      ])
    })

    it('pushes the status stored now, not one frozen onto the queue row', async () => {
      respondWith({ empFeatureIds: ['emp-object-id'], status: 'WITHDRAWN' })
      vi.mocked(updateFeatures).mockResolvedValue({
        updateResults: [{ success: true, objectId: 'emp-object-id' }]
      })

      await updateExemptionStatusInEmp(mockServer, {
        ...mockStatusQueueItem,
        status: 'ACTIVE'
      })

      const [call] = vi.mocked(updateFeatures).mock.calls
      expect(call[0].features[0].attributes.Status).toBe('Withdrawn')
    })

    it('throws the message that triggers a hard fail when no objectId is found', async () => {
      respondWith({ status: 'ACTIVE' })

      await expect(
        updateExemptionStatusInEmp(mockServer, mockStatusQueueItem)
      ).rejects.toThrow(
        'EMP status update failed: no objectId found for TEST-REF-001'
      )

      expect(updateFeatures).not.toHaveBeenCalled()
    })

    it('throws when the exemption has no mappable status', async () => {
      respondWith({ empFeatureIds: ['emp-object-id'], status: 'NOT_A_STATUS' })

      await expect(
        updateExemptionStatusInEmp(mockServer, mockStatusQueueItem)
      ).rejects.toThrow(
        'EMP status update failed: no status label for TEST-REF-001'
      )

      expect(updateFeatures).not.toHaveBeenCalled()
    })
  })
})
