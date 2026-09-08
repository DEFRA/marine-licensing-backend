import { vi } from 'vitest'
import { getProjectsController, sortByStatus } from './get-projects.js'
import { ObjectId } from 'mongodb'
import { PROJECT_STATUS_LABEL } from '../../../constants/project-status.js'
import {
  collectionExemptions,
  collectionMarineLicences
} from '../../../common/constants/db-collections.js'

vi.mock('../../../common/helpers/dynamics/get-contact-details.js', () => ({
  batchGetContactNames: vi.fn().mockResolvedValue({})
}))

describe('getProjectsController', () => {
  let mockRequest
  let mockH
  let mockDb
  let mockExemptionCollection
  let mockMarineLicenceCollection
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
      }),
      distinct: vi.fn().mockResolvedValue([])
    }
    return mock
  }

  const setupMocks = (exemptionResults = [], marineLicenceResults = []) => {
    mockExemptionCollection = createMockCollection(exemptionResults)
    mockMarineLicenceCollection = createMockCollection(marineLicenceResults)

    mockDb = {
      collection: vi.fn((name) => {
        if (name === collectionExemptions) return mockExemptionCollection
        if (name === collectionMarineLicences) {
          return mockMarineLicenceCollection
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

  const mockMarineLicences = [
    {
      _id: new ObjectId('507f1f77bcf86cd799439013'),
      status: 'DRAFT',
      projectName: 'Marine Project',
      contactId: testContactId
    }
  ]

  beforeEach(() => {
    setupMocks(mockExemptions, mockMarineLicences)
  })

  describe('payload validation', () => {
    const payloadValidator = getProjectsController.options.validate.payload

    it('should accept an empty payload', () => {
      const result = payloadValidator.validate({})

      expect(result.error).toBeUndefined()
    })

    it('should accept a fully formed payload', () => {
      const result = payloadValidator.validate({
        show: 'my-projects',
        status: ['ACTIVE', 'DRAFT'],
        type: ['exemption', 'marine-licence']
      })

      expect(result.error).toBeUndefined()
    })

    it('should accept a fully formed payload for a specific user', () => {
      const result = payloadValidator.validate({
        show: 'specific-user',
        user: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        status: ['ACTIVE', 'DRAFT'],
        type: ['exemption', 'marine-licence']
      })

      expect(result.error).toBeUndefined()
    })
  })

  describe('handler', () => {
    it('should query employee collection scoped to own projects when show value is missing', async () => {
      await getProjectsController.handler(mockRequest, mockH)

      expect(mockExemptionCollection.find).toHaveBeenCalledWith({
        'organisation.id': testOrgId,
        contactId: testContactId
      })
      expect(mockMarineLicenceCollection.find).toHaveBeenCalledWith({
        'organisation.id': testOrgId,
        contactId: testContactId
      })
    })

    it('should query employee collection scoped to own projects', async () => {
      mockRequest.payload = { show: 'my-projects' }

      await getProjectsController.handler(mockRequest, mockH)

      expect(mockExemptionCollection.find).toHaveBeenCalledWith({
        'organisation.id': testOrgId,
        contactId: testContactId
      })
      expect(mockMarineLicenceCollection.find).toHaveBeenCalledWith({
        'organisation.id': testOrgId,
        contactId: testContactId
      })
    })

    it('should query employee collection with organisation filter only when scope is is all-projects', async () => {
      mockRequest.payload = { show: 'all-projects' }

      await getProjectsController.handler(mockRequest, mockH)

      expect(mockExemptionCollection.find).toHaveBeenCalledWith({
        'organisation.id': testOrgId
      })
      expect(mockMarineLicenceCollection.find).toHaveBeenCalledWith({
        'organisation.id': testOrgId
      })
    })

    it('should query employee collection scoped to the specified user(s) when scope is specific-user', async () => {
      const otherContactId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
      const anotherContactId = 'e2c1a2a0-6b1a-4c1a-8b1a-6b1a4c1a8b1a'
      mockRequest.payload = {
        show: 'specific-user',
        user: [otherContactId, anotherContactId]
      }

      await getProjectsController.handler(mockRequest, mockH)

      expect(mockExemptionCollection.find).toHaveBeenCalledWith({
        'organisation.id': testOrgId,
        contactId: { $in: [otherContactId, anotherContactId] }
      })
      expect(mockMarineLicenceCollection.find).toHaveBeenCalledWith({
        'organisation.id': testOrgId,
        contactId: { $in: [otherContactId, anotherContactId] }
      })
    })

    it('should query employee collection with organisation filter only when scope is specific-user but no user is checked', async () => {
      mockRequest.payload = { show: 'specific-user' }

      await getProjectsController.handler(mockRequest, mockH)

      expect(mockExemptionCollection.find).toHaveBeenCalledWith({
        'organisation.id': testOrgId
      })
      expect(mockMarineLicenceCollection.find).toHaveBeenCalledWith({
        'organisation.id': testOrgId
      })
    })

    it('should resolve users via an organisation-wide query by default', async () => {
      mockRequest.payload = { show: 'my-projects', status: ['ACTIVE'] }

      await getProjectsController.handler(mockRequest, mockH)

      expect(mockExemptionCollection.distinct).toHaveBeenCalledWith(
        'contactId',
        { 'organisation.id': testOrgId }
      )
      expect(mockMarineLicenceCollection.distinct).toHaveBeenCalledWith(
        'contactId',
        { 'organisation.id': testOrgId }
      )

      const responseValue = mockH.response.mock.calls[0][0].value
      expect(responseValue.users).toEqual({})
    })

    it('should not resolve users when skipUsers is true', async () => {
      mockRequest.payload = { skipUsers: true }

      await getProjectsController.handler(mockRequest, mockH)

      expect(mockExemptionCollection.distinct).not.toHaveBeenCalled()
      expect(mockMarineLicenceCollection.distinct).not.toHaveBeenCalled()

      const responseValue = mockH.response.mock.calls[0][0].value
      expect(responseValue.users).toEqual({})
    })

    it('should only query the exemptions collection when type narrows to exemption', async () => {
      mockRequest.payload = { type: ['exemption'] }

      await getProjectsController.handler(mockRequest, mockH)

      expect(mockExemptionCollection.find).toHaveBeenCalled()
      expect(mockMarineLicenceCollection.find).not.toHaveBeenCalled()

      const responseValue = mockH.response.mock.calls[0][0].value
      expect(
        responseValue.projects.every((p) => p.projectType === 'EXEMPTION')
      ).toBe(true)
    })

    it('should only query the marine licence collection when type narrows to marine-licence', async () => {
      mockRequest.payload = { type: ['marine-licence'] }

      await getProjectsController.handler(mockRequest, mockH)

      expect(mockMarineLicenceCollection.find).toHaveBeenCalled()
      expect(mockExemptionCollection.find).not.toHaveBeenCalled()

      const responseValue = mockH.response.mock.calls[0][0].value
      expect(
        responseValue.projects.every((p) => p.projectType === 'MARINE_LICENCE')
      ).toBe(true)
    })

    it('should query citizen collection with contactId and no-org filter', async () => {
      mockRequest.auth = createAuthWithoutOrg()

      await getProjectsController.handler(mockRequest, mockH)

      const citizenFilter = {
        contactId: testContactId,
        'organisation.id': { $exists: false }
      }
      expect(mockExemptionCollection.find).toHaveBeenCalledWith(citizenFilter)
      expect(mockMarineLicenceCollection.find).toHaveBeenCalledWith(
        citizenFilter
      )

      const responseValue = mockH.response.mock.calls[0][0].value
      expect(responseValue.users).toEqual({})
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
        if (name === collectionMarineLicences) {
          return mockMarineLicenceCollection
        }
        return createMockCollection([])
      })

      await getProjectsController.handler(mockRequest, mockH)

      const responseValue = mockH.response.mock.calls[0][0].value
      expect(
        responseValue.projects.some((p) => p.projectType === 'MARINE_LICENCE')
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

    it('should put TRANSFERRED status at the top', () => {
      const projects = [
        { status: PROJECT_STATUS_LABEL.DRAFT, projectName: 'Draft Project' },
        {
          status: PROJECT_STATUS_LABEL.TRANSFERRED,
          projectName: 'Transferred Project'
        }
      ]
      const result = projects.sort(sortByStatus)
      expect(result[0].status).toBe(PROJECT_STATUS_LABEL.TRANSFERRED)
      expect(result[1].status).toBe(PROJECT_STATUS_LABEL.DRAFT)
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
