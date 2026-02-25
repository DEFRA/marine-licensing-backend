import { vi } from 'vitest'
import { getProjectsController, sortByStatus } from './get-projects.js'
import { ObjectId } from 'mongodb'
import { PROJECT_STATUS_LABEL } from '../../../constants/project-status.js'
import {
  collectionExemptions,
  collectionMarineLicenses
} from '../../../common/constants/db-collections.js'

vi.mock('../../../common/helpers/dynamics/get-contact-details.js', () => ({
  batchGetContactNames: vi.fn().mockResolvedValue({})
}))

describe('getProjectsController', () => {
  let mockRequest
  let mockH
  let mockDb
  let mockExemptionCollection
  let mockMarineLicenseCollection
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

  const createMockCollection = (toArrayResult) => {
    const mock = {
      find: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(toArrayResult)
        })
      })
    }
    return mock
  }

  const setupMocks = (exemptionResults = [], marineLicenseResults = []) => {
    mockExemptionCollection = createMockCollection(exemptionResults)
    mockMarineLicenseCollection = createMockCollection(marineLicenseResults)

    mockDb = {
      collection: vi.fn((name) => {
        if (name === collectionExemptions) return mockExemptionCollection
        if (name === collectionMarineLicenses) {
          return mockMarineLicenseCollection
        }
        return createMockCollection([])
      })
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

  const mockExemptions = [
    {
      _id: new ObjectId('507f1f77bcf86cd799439011'),
      status: 'ACTIVE',
      applicationReference: 'EXEMPTION-2024-001',
      projectName: 'Other Project',
      contactId: testContactId,
      submittedAt: '2024-01-15T10:00:00.000Z'
    },
    {
      _id: new ObjectId('507f1f77bcf86cd799439012'),
      status: 'DRAFT',
      projectName: 'Test Project',
      contactId: testContactId
    }
  ]

  const mockMarineLicenses = [
    {
      _id: new ObjectId('507f1f77bcf86cd799439013'),
      status: 'DRAFT',
      projectName: 'Marine Project',
      contactId: testContactId
    }
  ]

  beforeEach(() => setupMocks(mockExemptions, mockMarineLicenses))

  describe('handler', () => {
    it('should query employee collection with organisation filter', async () => {
      await getProjectsController.handler(mockRequest, mockH)

      expect(mockExemptionCollection.find).toHaveBeenCalledWith({
        'organisation.id': testOrgId
      })
      expect(mockMarineLicenseCollection.find).toHaveBeenCalledWith({
        'organisation.id': testOrgId
      })
    })

    it('should query citizen collection with contactId and no-org filter', async () => {
      mockRequest.auth = createAuthWithoutOrg()

      await getProjectsController.handler(mockRequest, mockH)

      const citizenFilter = {
        contactId: testContactId,
        'organisation.id': { $exists: false }
      }
      expect(mockExemptionCollection.find).toHaveBeenCalledWith(citizenFilter)
      expect(mockMarineLicenseCollection.find).toHaveBeenCalledWith(
        citizenFilter
      )
    })

    it('should exclude null entries when a query is rejected', async () => {
      mockRequest.auth = createAuthWithoutOrg()

      mockExemptionCollection = {
        find: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            toArray: vi
              .fn()
              .mockRejectedValue(new Error('DB connection failed'))
          })
        })
      }

      mockDb.collection = vi.fn((name) => {
        if (name === collectionExemptions) return mockExemptionCollection
        if (name === collectionMarineLicenses) {
          return mockMarineLicenseCollection
        }
        return createMockCollection([])
      })

      await getProjectsController.handler(mockRequest, mockH)

      const responseValue = mockH.response.mock.calls[0][0].value
      expect(
        responseValue.some((p) => p.projectType === 'MARINE_LICENCE')
      ).toBe(true)
    })

    it('should throw error when user is not authenticated', async () => {
      mockRequest.auth = {
        credentials: {},
        artifacts: {
          decoded: {
            relationships: []
          }
        }
      }

      await expect(
        getProjectsController.handler(mockRequest, mockH)
      ).rejects.toThrow('User not authenticated')
    })
  })

  describe('sortByStatus', () => {
    it('should put DRAFT status at the top', () => {
      const projects = [
        {
          status: PROJECT_STATUS_LABEL.ACTIVE,
          projectName: 'Active Project'
        },
        { status: PROJECT_STATUS_LABEL.DRAFT, projectName: 'Draft Project' }
      ]
      const result = projects.sort(sortByStatus)
      expect(result[0].status).toBe(PROJECT_STATUS_LABEL.DRAFT)
      expect(result[1].status).toBe(PROJECT_STATUS_LABEL.ACTIVE)
    })

    it('should handle unknown status by placing it last', () => {
      const projects = [
        { status: 'UNKNOWN_STATUS', projectName: 'Unknown Project' },
        { status: PROJECT_STATUS_LABEL.DRAFT, projectName: 'Draft Project' }
      ]
      const result = projects.sort(sortByStatus)
      expect(result[0].status).toBe(PROJECT_STATUS_LABEL.DRAFT)
      expect(result[1].status).toBe('UNKNOWN_STATUS')
    })
  })
})
