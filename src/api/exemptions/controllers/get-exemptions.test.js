import { jest } from '@jest/globals'
import { getMyExemptionsController } from './get-exemptions.js'
import { ObjectId } from 'mongodb'
import {
  EXEMPTION_STATUS,
  EXEMPTION_TYPE
} from '../../../common/constants/exemption.js'
import { config } from '../../../config.js'

jest.mock('../../../config.js')

describe('getMyExemptionsController', () => {
  let mockRequest
  let mockH
  let mockDb
  let mockCollection

  beforeEach(() => {
    config.get.mockReturnValue({
      authEnabled: true
    })

    mockCollection = {
      find: jest.fn().mockReturnThis(),
      toArray: jest.fn()
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
      const mockExemptions = [
        {
          _id: new ObjectId('507f1f77bcf86cd799439011'),
          status: EXEMPTION_STATUS.CLOSED,
          projectName: 'Test Project 1',
          applicationReference: 'EXEMPTION-2024-001',
          submittedAt: '2024-01-15T10:00:00.000Z',
          contactId: 'test-contact-id'
        },
        {
          _id: new ObjectId('507f1f77bcf86cd799439012'),
          projectName: 'Test Project 2',
          status: EXEMPTION_STATUS.DRAFT,
          contactId: 'test-contact-id'
        }
      ]

      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockExemptions)
      })

      await getMyExemptionsController.handler(mockRequest, mockH)

      expect(mockDb.collection).toHaveBeenCalledWith('exemptions')
      expect(mockCollection.find).toHaveBeenCalledWith({
        contactId: 'test-contact-id'
      })

      expect(mockH.response).toHaveBeenCalledWith({
        message: 'success',
        value: [
          {
            id: '507f1f77bcf86cd799439012',
            projectName: 'Test Project 2',
            type: EXEMPTION_TYPE.EXEMPT_ACTIVITY,
            status: EXEMPTION_STATUS.DRAFT
          },
          {
            id: '507f1f77bcf86cd799439011',
            projectName: 'Test Project 1',
            type: EXEMPTION_TYPE.EXEMPT_ACTIVITY,
            applicationReference: 'EXEMPTION-2024-001',
            status: EXEMPTION_STATUS.CLOSED,
            submittedAt: '2024-01-15T10:00:00.000Z'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should return empty array when user has no exemptions', async () => {
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      })

      await getMyExemptionsController.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        message: 'success',
        value: []
      })
    })

    it('should handle missing data', async () => {
      const mockExemptions = [
        {
          _id: new ObjectId('507f1f77bcf86cd799439011')
        }
      ]

      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockExemptions)
      })

      await getMyExemptionsController.handler(mockRequest, mockH)

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
      const mockExemptions = [
        {
          _id: new ObjectId('507f1f77bcf86cd799439011'),
          status: EXEMPTION_STATUS.CLOSED,
          projectName: 'Other Project',
          contactId: 'test-contact-id'
        },
        {
          _id: new ObjectId('507f1f77bcf86cd799439012'),
          status: EXEMPTION_STATUS.DRAFT,
          projectName: 'Alpha Project',
          contactId: 'test-contact-id'
        },
        {
          _id: new ObjectId('507f1f77bcf86cd799439013'),
          status: 'Unknown status',
          projectName: 'Beta Project',
          contactId: 'test-contact-id'
        }
      ]

      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockExemptions)
      })

      await getMyExemptionsController.handler(mockRequest, mockH)

      const responseValue = mockH.response.mock.calls[0][0].value

      expect(responseValue[0].status).toBe(EXEMPTION_STATUS.DRAFT)
      expect(responseValue[1].status).toBe(EXEMPTION_STATUS.CLOSED)
      expect(responseValue[2].status).toBe('Unknown status')
    })

    it('should sort exemptions by project name within same status', async () => {
      const mockExemptions = [
        {
          _id: new ObjectId('507f1f77bcf86cd799439011'),
          status: EXEMPTION_STATUS.DRAFT,
          projectName: 'Other Project',
          contactId: 'test-contact-id'
        },
        {
          _id: new ObjectId('507f1f77bcf86cd799439012'),
          status: EXEMPTION_STATUS.DRAFT,
          projectName: 'Alpha Project',
          contactId: 'test-contact-id'
        },
        {
          _id: new ObjectId('507f1f77bcf86cd799439013'),
          status: EXEMPTION_STATUS.DRAFT,
          projectName: 'Beta Project',
          contactId: 'test-contact-id'
        }
      ]

      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockExemptions)
      })

      await getMyExemptionsController.handler(mockRequest, mockH)

      const responseValue = mockH.response.mock.calls[0][0].value

      expect(responseValue[0].projectName).toBe('Alpha Project')
      expect(responseValue[1].projectName).toBe('Beta Project')
      expect(responseValue[2].projectName).toBe('Other Project')
    })

    it('should handle exemptions without project names gracefully', async () => {
      const mockExemptions = [
        {
          _id: new ObjectId('507f1f77bcf86cd799439011'),
          status: EXEMPTION_STATUS.DRAFT,
          contactId: 'test-contact-id'
        },
        {
          _id: new ObjectId('507f1f77bcf86cd799439012'),
          status: EXEMPTION_STATUS.DRAFT,
          projectName: 'Alpha Project',
          contactId: 'test-contact-id'
        }
      ]

      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockExemptions)
      })

      await getMyExemptionsController.handler(mockRequest, mockH)

      const responseValue = mockH.response.mock.calls[0][0].value

      expect(responseValue).toHaveLength(2)
      expect(responseValue[0].status).toBe(EXEMPTION_STATUS.DRAFT)
      expect(responseValue[1].status).toBe(EXEMPTION_STATUS.DRAFT)
    })

    it('should sort by status first (Draft, then Closed), then by project name within each status group', async () => {
      const mockExemptions = [
        {
          _id: new ObjectId('507f1f77bcf86cd799439011'),
          status: EXEMPTION_STATUS.CLOSED,
          projectName: 'Alpha Closed Project',
          contactId: 'test-contact-id'
        },
        {
          _id: new ObjectId('507f1f77bcf86cd799439012'),
          status: EXEMPTION_STATUS.DRAFT,
          projectName: 'Other Draft Project',
          contactId: 'test-contact-id'
        },
        {
          _id: new ObjectId('507f1f77bcf86cd799439013'),
          status: EXEMPTION_STATUS.CLOSED,
          projectName: 'Beta Closed Project',
          contactId: 'test-contact-id'
        },
        {
          _id: new ObjectId('507f1f77bcf86cd799439014'),
          status: EXEMPTION_STATUS.DRAFT,
          projectName: 'Alpha Draft Project',
          contactId: 'test-contact-id'
        }
      ]

      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockExemptions)
      })

      await getMyExemptionsController.handler(mockRequest, mockH)

      const responseValue = mockH.response.mock.calls[0][0].value

      expect(responseValue).toHaveLength(4)

      expect(responseValue[0].status).toBe(EXEMPTION_STATUS.DRAFT)
      expect(responseValue[0].projectName).toBe('Alpha Draft Project')
      expect(responseValue[1].status).toBe(EXEMPTION_STATUS.DRAFT)
      expect(responseValue[1].projectName).toBe('Other Draft Project')

      expect(responseValue[2].status).toBe(EXEMPTION_STATUS.CLOSED)
      expect(responseValue[2].projectName).toBe('Alpha Closed Project')
      expect(responseValue[3].status).toBe(EXEMPTION_STATUS.CLOSED)
      expect(responseValue[3].projectName).toBe('Beta Closed Project')
    })
  })
})
