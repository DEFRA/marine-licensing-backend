import { jest } from '@jest/globals'
import { getExemptionsController, sortByStatus } from './get-exemptions.js'
import { ObjectId } from 'mongodb'
import { EXEMPTION_STATUS } from '../../../common/constants/exemption.js'
import { getApplicantOrganisationId } from '../helpers/get-applicant-organisation.js'

jest.mock('../helpers/get-applicant-organisation.js', () => ({
  getApplicantOrganisationId: jest.fn()
}))

describe('getExemptionsController', () => {
  let mockRequest
  let mockH
  let mockDb
  let mockCollection

  const mockExemptions = [
    {
      _id: new ObjectId('507f1f77bcf86cd799439011'),
      status: EXEMPTION_STATUS.ACTIVE,
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
    },
    {
      _id: new ObjectId('507f1f77bcf86cd799439013'),
      status: 'Closed',
      projectName: 'Beta Project',
      contactId: 'test-contact-id'
    }
  ]

  beforeEach(() => {
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

    getApplicantOrganisationId.mockReturnValue('test-org-id')
  })

  describe('handler', () => {
    it('should return all exemptions for a user with correct format', async () => {
      mockCollection.find().sort().toArray.mockResolvedValue(mockExemptions)

      await getExemptionsController.handler(mockRequest, mockH)

      expect(mockDb.collection).toHaveBeenCalledWith('exemptions')
      expect(mockCollection.find).toHaveBeenCalledWith({
        contactId: 'test-contact-id',
        'organisations.applicant.id': 'test-org-id'
      })

      expect(mockH.response).toHaveBeenCalledWith({
        message: 'success',
        value: [
          {
            id: '507f1f77bcf86cd799439012',
            projectName: 'Test Project',
            status: 'Draft'
          },
          {
            id: '507f1f77bcf86cd799439011',
            projectName: 'Other Project',
            applicationReference: 'EXEMPTION-2024-001',
            status: 'Active',
            submittedAt: '2024-01-15T10:00:00.000Z'
          },
          {
            id: '507f1f77bcf86cd799439013',
            projectName: 'Beta Project',
            status: 'Active'
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

      expect(responseValue[0].status).toBe('Draft')
      expect(responseValue[1].status).toBe('Active')
      expect(responseValue[2].status).toBe('Active')
      expect(responseValue[3].status).toBe('Unknown status')
    })

    it('should rename Closed status to Active', async () => {
      mockCollection
        .find()
        .sort()
        .toArray.mockResolvedValue([{ _id: 'test', status: 'Closed' }])

      await getExemptionsController.handler(mockRequest, mockH)

      const responseValue = mockH.response.mock.calls[0][0].value

      expect(responseValue[0].status).toBe('Active')
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
      expect(responseValue[0].status).toBe('Draft')
      expect(responseValue[1].status).toBe('Draft')
    })

    it('should call sort with projectName in descending order', async () => {
      mockCollection.find().sort().toArray.mockResolvedValue(mockExemptions)

      await getExemptionsController.handler(mockRequest, mockH)

      expect(mockCollection.find().sort).toHaveBeenCalledWith({
        projectName: 1
      })
    })

    it('should query with null applicantOrganisationId when getApplicantOrganisationId returns null', async () => {
      getApplicantOrganisationId.mockReturnValue(null)
      mockCollection.find().sort().toArray.mockResolvedValue(mockExemptions)

      await getExemptionsController.handler(mockRequest, mockH)

      expect(mockCollection.find).toHaveBeenCalledWith({
        contactId: 'test-contact-id',
        'organisations.applicant.id': null
      })
    })
  })

  describe('sortByStatus', () => {
    it('should put DRAFTs at the top', () => {
      const exemptions = [
        { status: EXEMPTION_STATUS.DRAFT, projectName: 'Draft Project' },
        { status: EXEMPTION_STATUS.ACTIVE, projectName: 'Closed Project' }
      ]
      const result = exemptions.sort(sortByStatus)
      expect(result[0].status).toBe(EXEMPTION_STATUS.DRAFT)
      expect(result[1].status).toBe(EXEMPTION_STATUS.ACTIVE)
    })

    it('should correctly hadle unknown status', () => {
      const exemptions = [
        { status: 'UNKNOWN_STATUS', projectName: 'Unknown Project' },
        { status: 'Draft', projectName: 'Draft Project' }
      ]
      const result = exemptions.sort(sortByStatus)
      expect(result[0].status).toBe('Draft')
      expect(result[1].status).toBe('UNKNOWN_STATUS')
      expect(result[1].projectName).toBe('Unknown Project')
    })
  })
})
