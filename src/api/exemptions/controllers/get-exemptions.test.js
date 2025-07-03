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
            id: '507f1f77bcf86cd799439011',
            projectName: 'Test Project 1',
            type: EXEMPTION_TYPE.EXEMPT_ACTIVITY,
            applicationReference: 'EXEMPTION-2024-001',
            status: EXEMPTION_STATUS.CLOSED,
            submittedAt: '2024-01-15T10:00:00.000Z'
          },
          {
            id: '507f1f77bcf86cd799439012',
            projectName: 'Test Project 2',
            type: EXEMPTION_TYPE.EXEMPT_ACTIVITY,
            status: EXEMPTION_STATUS.DRAFT
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
  })
})
