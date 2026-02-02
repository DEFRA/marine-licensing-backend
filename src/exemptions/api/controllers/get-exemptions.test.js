import { vi } from 'vitest'
import { getExemptionsController, sortByStatus } from './get-exemptions.js'
import { ObjectId } from 'mongodb'
import {
  EXEMPTION_STATUS,
  EXEMPTION_STATUS_LABEL
} from '../../constants/exemption.js'

describe('getExemptionsController', () => {
  let mockRequest
  let mockH
  let mockDb
  let mockCollection
  const testContactId = 'contact-123-abc'
  const testOrgId = '27d48d6c-6e94-f011-b4cc-000d3ac28f39'

  const createAuthWithOrg = (organisationId = testOrgId) => ({
    credentials: {
      contactId: testContactId
    },
    artifacts: {
      decoded: {
        currentRelationshipId: '81d48d6c-6e94-f011-b4cc-000d3ac28f39',
        relationships: [
          `81d48d6c-6e94-f011-b4cc-000d3ac28f39:${organisationId}:CDP Child Org 1:0:Employee:0`
        ]
      }
    }
  })

  const createAuthWithoutOrg = () => ({
    credentials: {
      contactId: testContactId
    },
    artifacts: {
      decoded: {
        relationships: []
      }
    }
  })

  const mockExemptions = [
    {
      _id: new ObjectId('507f1f77bcf86cd799439011'),
      status: EXEMPTION_STATUS.ACTIVE,
      applicationReference: 'EXEMPTION-2024-001',
      projectName: 'Other Project',
      contactId: testContactId,
      submittedAt: '2024-01-15T10:00:00.000Z'
    },
    {
      _id: new ObjectId('507f1f77bcf86cd799439012'),
      status: EXEMPTION_STATUS.DRAFT,
      projectName: 'Test Project',
      contactId: testContactId
    },
    {
      _id: new ObjectId('507f1f77bcf86cd799439013'),
      status: 'Unknown status',
      projectName: 'Beta Project',
      contactId: testContactId
    },
    {
      _id: new ObjectId('507f1f77bcf86cd799439013'),
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Beta Project',
      contactId: testContactId
    }
  ]

  const setupMocks = () => {
    mockCollection = {
      find: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          toArray: vi.fn()
        })
      })
    }

    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection)
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    mockRequest = {
      db: mockDb,
      auth: createAuthWithOrg()
    }
  }

  beforeEach(() => setupMocks())

  describe('handler', () => {
    it('should return all exemptions for a user with correct format when organisation id present', async () => {
      mockCollection.find().sort().toArray.mockResolvedValue(mockExemptions)

      await getExemptionsController.handler(mockRequest, mockH)

      expect(mockDb.collection).toHaveBeenCalledWith('exemptions')
      expect(mockCollection.find).toHaveBeenCalledWith({
        contactId: testContactId,
        'organisation.id': testOrgId
      })

      expect(mockH.response).toHaveBeenCalledWith({
        message: 'success',
        value: [
          {
            id: '507f1f77bcf86cd799439012',
            projectName: 'Test Project',
            status: EXEMPTION_STATUS_LABEL.DRAFT
          },
          {
            id: '507f1f77bcf86cd799439011',
            projectName: 'Other Project',
            applicationReference: 'EXEMPTION-2024-001',
            status: EXEMPTION_STATUS_LABEL.ACTIVE,
            submittedAt: '2024-01-15T10:00:00.000Z'
          },
          {
            id: '507f1f77bcf86cd799439013',
            projectName: 'Beta Project',
            status: EXEMPTION_STATUS_LABEL.ACTIVE
          },
          {
            id: '507f1f77bcf86cd799439013',
            projectName: 'Beta Project',
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
            id: '507f1f77bcf86cd799439011'
          }
        ]
      })
    })

    it('should sort exemptions by status priority (DRAFT first, then ACTIVE, then others)', async () => {
      mockCollection.find().sort().toArray.mockResolvedValue(mockExemptions)

      await getExemptionsController.handler(mockRequest, mockH)

      const responseValue = mockH.response.mock.calls[0][0].value

      expect(responseValue[0].status).toBe(EXEMPTION_STATUS_LABEL.DRAFT)
      expect(responseValue[1].status).toBe(EXEMPTION_STATUS_LABEL.ACTIVE)
      expect(responseValue[2].status).toBe(EXEMPTION_STATUS_LABEL.ACTIVE)
      expect(responseValue[3].status).toBe('Unknown status')
    })

    it('should rename Closed status to Active', async () => {
      mockCollection
        .find()
        .sort()
        .toArray.mockResolvedValue([
          { _id: 'test', status: EXEMPTION_STATUS.ACTIVE }
        ])

      await getExemptionsController.handler(mockRequest, mockH)

      const responseValue = mockH.response.mock.calls[0][0].value

      expect(responseValue[0].status).toBe(EXEMPTION_STATUS_LABEL.ACTIVE)
    })

    it('should handle exemptions without project names gracefully', async () => {
      mockCollection
        .find()
        .sort()
        .toArray.mockResolvedValue([
          {
            _id: new ObjectId('507f1f77bcf86cd799439011'),
            status: EXEMPTION_STATUS.DRAFT,
            contactId: testContactId
          },
          mockExemptions[1]
        ])

      await getExemptionsController.handler(mockRequest, mockH)

      const responseValue = mockH.response.mock.calls[0][0].value

      expect(responseValue).toHaveLength(2)
      expect(responseValue[0].status).toBe(EXEMPTION_STATUS_LABEL.DRAFT)
      expect(responseValue[1].status).toBe(EXEMPTION_STATUS_LABEL.DRAFT)
    })

    it('should call sort with projectName in descending order', async () => {
      mockCollection.find().sort().toArray.mockResolvedValue(mockExemptions)

      await getExemptionsController.handler(mockRequest, mockH)

      expect(mockCollection.find().sort).toHaveBeenCalledWith({
        projectName: 1
      })
    })

    it('should exclude exemptions with beneficiary organisation when user has no relationships', async () => {
      mockRequest.auth = createAuthWithoutOrg()
      mockCollection.find().sort().toArray.mockResolvedValue(mockExemptions)

      await getExemptionsController.handler(mockRequest, mockH)

      expect(mockCollection.find).toHaveBeenCalledWith({
        contactId: testContactId,
        'organisation.id': { $exists: false }
      })
    })

    it('should throw error when user is not authenticated (no contactId)', async () => {
      mockRequest.auth = {
        credentials: {},
        artifacts: {
          decoded: {
            relationships: []
          }
        }
      }

      await expect(
        getExemptionsController.handler(mockRequest, mockH)
      ).rejects.toThrow('User not authenticated')
    })

    it('should return OK status code', async () => {
      mockCollection.find().sort().toArray.mockResolvedValue(mockExemptions)

      await getExemptionsController.handler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(200)
    })
  })

  describe('sortByStatus', () => {
    it('should put DRAFT status at the top', () => {
      const exemptions = [
        {
          status: EXEMPTION_STATUS_LABEL.ACTIVE,
          projectName: 'Active Project'
        },
        { status: EXEMPTION_STATUS_LABEL.DRAFT, projectName: 'Draft Project' }
      ]
      const result = exemptions.sort(sortByStatus)
      expect(result[0].status).toBe(EXEMPTION_STATUS_LABEL.DRAFT)
      expect(result[1].status).toBe(EXEMPTION_STATUS_LABEL.ACTIVE)
    })

    it('should put ACTIVE status second', () => {
      const exemptions = [
        { status: 'Unknown', projectName: 'Unknown Project' },
        {
          status: EXEMPTION_STATUS_LABEL.ACTIVE,
          projectName: 'Active Project'
        },
        { status: EXEMPTION_STATUS_LABEL.DRAFT, projectName: 'Draft Project' }
      ]
      const result = exemptions.sort(sortByStatus)
      expect(result[0].status).toBe(EXEMPTION_STATUS_LABEL.DRAFT)
      expect(result[1].status).toBe(EXEMPTION_STATUS_LABEL.ACTIVE)
      expect(result[2].status).toBe('Unknown')
    })

    it('should handle unknown status by placing it last', () => {
      const exemptions = [
        { status: 'UNKNOWN_STATUS', projectName: 'Unknown Project' },
        { status: EXEMPTION_STATUS_LABEL.DRAFT, projectName: 'Draft Project' }
      ]
      const result = exemptions.sort(sortByStatus)
      expect(result[0].status).toBe(EXEMPTION_STATUS_LABEL.DRAFT)
      expect(result[1].status).toBe('UNKNOWN_STATUS')
      expect(result[1].projectName).toBe('Unknown Project')
    })

    it('should preserve order for multiple items with same status', () => {
      const exemptions = [
        { status: EXEMPTION_STATUS_LABEL.ACTIVE, projectName: 'Active 1' },
        { status: EXEMPTION_STATUS_LABEL.ACTIVE, projectName: 'Active 2' }
      ]
      const result = exemptions.sort(sortByStatus)
      expect(result).toHaveLength(2)
      expect(result[0].status).toBe(EXEMPTION_STATUS_LABEL.ACTIVE)
      expect(result[1].status).toBe(EXEMPTION_STATUS_LABEL.ACTIVE)
    })
  })
})
