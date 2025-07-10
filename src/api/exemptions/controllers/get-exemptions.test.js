import { jest } from '@jest/globals'
import { getExemptionsController, sortByStatus } from './get-exemptions.js'
import { ObjectId } from 'mongodb'
import {
  EXEMPTION_STATUS,
  EXEMPTION_TYPE
} from '../../../common/constants/exemption.js'
import { config } from '../../../config.js'

jest.mock('../../../config.js')

describe('getExemptionsController', () => {
  let mockRequest
  let mockH
  let mockDb
  let mockCollection

  const mockExemptions = [
    {
      _id: new ObjectId('507f1f77bcf86cd799439011'),
      status: EXEMPTION_STATUS.CLOSED,
      applicationReference: 'EXEMPTION-2024-001',
      projectName: 'Other Project',
      contactId: 'test-contact-id',
      submittedAt: '2024-01-15T10:00:00.000Z'
    },
    {
      _id: new ObjectId('507f1f77bcf86cd799439012'),
      status: EXEMPTION_STATUS.DRAFT,
      projectName: 'Test Project',
      contactId: 'test-contact-id'
    },
    {
      _id: new ObjectId('507f1f77bcf86cd799439013'),
      status: 'Unknown status',
      projectName: 'Beta Project',
      contactId: 'test-contact-id'
    }
  ]

  beforeEach(() => {
    config.get.mockReturnValue({
      authEnabled: true
    })

    mockCollection = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          toArray: jest.fn()
        }),
        toArray: jest.fn()
      })
    }

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection)
    }

    mockH = {
      response: jest.fn().mockReturnThis(),
      code: jest.fn().mockReturnThis()
    }

    mockRequest = {
      db: mockDb,
      auth: {
        credentials: {
          contactId: 'test-contact-id'
        }
      }
    }
  })

  describe('handler', () => {
    it('should return all exemptions for a user with correct format', async () => {
      mockCollection.find().sort().toArray.mockResolvedValue(mockExemptions)

      await getExemptionsController.handler(mockRequest, mockH)

      expect(mockDb.collection).toHaveBeenCalledWith('exemptions')
      expect(mockCollection.find).toHaveBeenCalledWith({
        contactId: 'test-contact-id'
      })

      expect(mockH.response).toHaveBeenCalledWith({
        message: 'success',
        value: [
          {
            id: '507f1f77bcf86cd799439012',
            projectName: 'Test Project',
            type: EXEMPTION_TYPE.EXEMPT_ACTIVITY,
            status: EXEMPTION_STATUS.DRAFT
          },
          {
            id: '507f1f77bcf86cd799439011',
            projectName: 'Other Project',
            type: EXEMPTION_TYPE.EXEMPT_ACTIVITY,
            applicationReference: 'EXEMPTION-2024-001',
            status: EXEMPTION_STATUS.CLOSED,
            submittedAt: '2024-01-15T10:00:00.000Z'
          },
          {
            id: '507f1f77bcf86cd799439013',
            projectName: 'Beta Project',
            type: EXEMPTION_TYPE.EXEMPT_ACTIVITY,
            status: 'Unknown status'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should return empty array when user has no exemptions', async () => {
      mockCollection.find().sort().toArray.mockResolvedValue([])

      await getExemptionsController.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        message: 'success',
        value: []
      })
    })

    it('should handle missing data', async () => {
      mockCollection
        .find()
        .sort()
        .toArray.mockResolvedValue([
          {
            _id: new ObjectId('507f1f77bcf86cd799439011')
          }
        ])

      await getExemptionsController.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        message: 'success',
        value: [
          {
            id: '507f1f77bcf86cd799439011',
            type: EXEMPTION_TYPE.EXEMPT_ACTIVITY
          }
        ]
      })
    })

    it('should sort exemptions by status priority (DRAFT first, then CLOSED, then others)', async () => {
      mockCollection.find().sort().toArray.mockResolvedValue(mockExemptions)

      await getExemptionsController.handler(mockRequest, mockH)

      const responseValue = mockH.response.mock.calls[0][0].value

      expect(responseValue[0].status).toBe(EXEMPTION_STATUS.DRAFT)
      expect(responseValue[1].status).toBe(EXEMPTION_STATUS.CLOSED)
      expect(responseValue[2].status).toBe('Unknown status')
    })

    it('should handle exemptions without project names gracefully', async () => {
      mockCollection
        .find()
        .sort()
        .toArray.mockResolvedValue([
          {
            _id: new ObjectId('507f1f77bcf86cd799439011'),
            status: EXEMPTION_STATUS.DRAFT,
            contactId: 'test-contact-id'
          },
          mockExemptions[1]
        ])

      await getExemptionsController.handler(mockRequest, mockH)

      const responseValue = mockH.response.mock.calls[0][0].value

      expect(responseValue).toHaveLength(2)
      expect(responseValue[0].status).toBe(EXEMPTION_STATUS.DRAFT)
      expect(responseValue[1].status).toBe(EXEMPTION_STATUS.DRAFT)
    })

    it('should call sort with projectName in descending order', async () => {
      mockCollection.find().sort().toArray.mockResolvedValue(mockExemptions)

      await getExemptionsController.handler(mockRequest, mockH)

      expect(mockCollection.find().sort).toHaveBeenCalledWith({
        projectName: 1
      })
    })
  })

  describe('sortByStatus', () => {
    it('should put DRAFTs at the top', () => {
      const exemptions = [
        { status: EXEMPTION_STATUS.DRAFT, projectName: 'Draft Project' },
        { status: EXEMPTION_STATUS.CLOSED, projectName: 'Closed Project' }
      ]
      const result = exemptions.sort(sortByStatus)
      expect(result[0].status).toBe(EXEMPTION_STATUS.DRAFT)
      expect(result[1].status).toBe(EXEMPTION_STATUS.CLOSED)
    })

    it('should correctly hadle unknown status', () => {
      const exemptions = [
        { status: 'UNKNOWN_STATUS', projectName: 'Unknown Project' },
        { status: EXEMPTION_STATUS.DRAFT, projectName: 'Draft Project' }
      ]
      const result = exemptions.sort(sortByStatus)
      expect(result[0].status).toBe(EXEMPTION_STATUS.DRAFT)
      expect(result[1].status).toBe('UNKNOWN_STATUS')
      expect(result[1].projectName).toBe('Unknown Project')
    })
  })
})
