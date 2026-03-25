import { vi } from 'vitest'
import { submitMarineLicenceController } from './submit-marine-licence.js'
import { generateApplicationReference } from '../../../shared/helpers/reference-generator.js'
import { createTaskList } from '../helpers/createTaskList.js'
import { addToDynamicsQueue } from '../../../shared/common/helpers/dynamics/dynamics-processor.js'
import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import {
  DYNAMICS_REQUEST_ACTIONS,
  DYNAMICS_QUEUE_TYPES
} from '../../../shared/common/constants/request-queue.js'
import { config } from '../../../config.js'
import { sendEmailConfirmation } from '../../../shared/helpers/send-email-confirmation.js'

vi.mock('../../../shared/helpers/reference-generator.js')
vi.mock('../helpers/createTaskList.js')
vi.mock('../../../shared/common/helpers/dynamics/dynamics-processor.js')
vi.mock('../../../config.js')
vi.mock('../../../shared/helpers/send-email-confirmation.js')

describe('POST /marine-licence/submit', () => {
  let mockDb
  let mockLocker
  let mockHandler
  let mockMarineLicenceId
  let mockDate
  let mockAuth
  let mockLogger
  let mockMarineLicencesCollection

  const mockAuditPayload = {
    updatedAt: new Date('2025-02-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  beforeEach(() => {
    mockDate = new Date('2025-06-15T10:30:00Z')
    vi.spyOn(global, 'Date').mockImplementation(function () {
      return mockDate
    })
    Date.now = vi.fn(() => mockDate.getTime())

    mockMarineLicenceId = new ObjectId().toHexString()

    mockHandler = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    mockAuth = {
      credentials: {
        contactId: 'test-contact-id'
      },
      artifacts: {
        decoded: {
          currentRelationshipId: '81d48d6c-6e94-f011-b4cc-000d3ac28f39',
          relationships: [
            `81d48d6c-6e94-f011-b4cc-000d3ac28f39:27d48d6c-6e94-f011-b4cc-000d3ac28f39:CDP Child Org 1:0:Employee:0`
          ]
        }
      }
    }

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockMarineLicencesCollection = {
      findOne: vi.fn(),
      updateOne: vi.fn()
    }

    mockDb = {
      collection: vi.fn().mockImplementation((collectionName) => {
        if (collectionName === 'marine-licences') {
          return mockMarineLicencesCollection
        }
        return {
          findOne: vi.fn(),
          updateOne: vi.fn()
        }
      })
    }

    mockLocker = {
      lock: vi.fn()
    }

    generateApplicationReference.mockResolvedValue('MLA/2025/10001')
    createTaskList.mockReturnValue({
      projectName: 'COMPLETED'
    })

    config.get.mockImplementation((key) => {
      if (key === 'dynamics') return { isDynamicsEnabled: false }
      if (key === 'frontEndBaseUrl') {
        return 'https://marine-licensing.defra.gov.uk'
      }
      return {}
    })
    vi.mocked(addToDynamicsQueue).mockResolvedValue(undefined)
    vi.mocked(sendEmailConfirmation).mockResolvedValue(undefined)
  })

  describe('Payload Validation', () => {
    it('should validate required marine licence ID', () => {
      const payloadValidator =
        submitMarineLicenceController.options.validate.payload

      const result = payloadValidator.validate({})

      expect(result.error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
    })

    it('should validate marine licence ID format', () => {
      const payloadValidator =
        submitMarineLicenceController.options.validate.payload

      const result = payloadValidator.validate({ id: 'invalid-id' })

      expect(result.error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
    })

    it('should accept valid request payload', () => {
      const payloadValidator =
        submitMarineLicenceController.options.validate.payload

      const result = payloadValidator.validate({
        id: mockMarineLicenceId,
        userEmail: 'test@example.com',
        userName: 'Test User'
      })

      expect(result.error).toBeUndefined()
    })
  })

  describe('Successful Submission', () => {
    it('should generate reference and update record on successful submission', async () => {
      const mockMarineLicence = {
        _id: ObjectId.createFromHexString(mockMarineLicenceId),
        contactId: 'test-contact-id',
        projectName: 'Test Marine Project'
      }

      mockMarineLicencesCollection.findOne.mockResolvedValue(mockMarineLicence)
      mockMarineLicencesCollection.updateOne.mockResolvedValue({
        matchedCount: 1
      })

      await submitMarineLicenceController.handler(
        {
          payload: { id: mockMarineLicenceId, ...mockAuditPayload },
          db: mockDb,
          locker: mockLocker,
          auth: mockAuth,
          logger: mockLogger
        },
        mockHandler
      )

      expect(generateApplicationReference).toHaveBeenCalledWith(
        mockDb,
        mockLocker,
        'MARINE_LICENCE'
      )

      expect(mockMarineLicencesCollection.updateOne).toHaveBeenCalledWith(
        { _id: ObjectId.createFromHexString(mockMarineLicenceId) },
        {
          $set: {
            applicationReference: 'MLA/2025/10001',
            submittedAt: mockDate,
            status: MARINE_LICENCE_STATUS.SUBMITTED,
            updatedAt: mockAuditPayload.updatedAt,
            updatedBy: mockAuditPayload.updatedBy
          }
        }
      )
    })

    it('should validate task completion before submission', async () => {
      const mockMarineLicence = {
        _id: ObjectId.createFromHexString(mockMarineLicenceId),
        contactId: 'test-contact-id',
        projectName: 'Test Project'
      }

      mockMarineLicencesCollection.findOne.mockResolvedValue(mockMarineLicence)
      mockMarineLicencesCollection.updateOne.mockResolvedValue({
        matchedCount: 1
      })

      await submitMarineLicenceController.handler(
        {
          payload: { id: mockMarineLicenceId },
          db: mockDb,
          locker: mockLocker,
          auth: mockAuth,
          logger: mockLogger
        },
        mockHandler
      )

      expect(createTaskList).toHaveBeenCalledWith(mockMarineLicence, false)
    })
  })

  describe('Email Confirmation', () => {
    it('should send confirmation email on successful submission', async () => {
      const mockMarineLicence = {
        _id: ObjectId.createFromHexString(mockMarineLicenceId),
        contactId: 'test-contact-id',
        projectName: 'Test Marine Project',
        organisation: { name: 'Test Org', userRelationshipType: 'Employee' }
      }

      mockMarineLicencesCollection.findOne.mockResolvedValue(mockMarineLicence)
      mockMarineLicencesCollection.updateOne.mockResolvedValue({
        matchedCount: 1
      })

      await submitMarineLicenceController.handler(
        {
          payload: {
            id: mockMarineLicenceId,
            userName: 'Jane Doe',
            userEmail: 'jane@example.com',
            ...mockAuditPayload
          },
          db: mockDb,
          locker: mockLocker,
          auth: mockAuth,
          logger: mockLogger
        },
        mockHandler
      )

      expect(sendEmailConfirmation).toHaveBeenCalledWith({
        db: mockDb,
        userName: 'Jane Doe',
        userEmail: 'jane@example.com',
        organisation: mockMarineLicence.organisation,
        applicationReference: 'MLA/2025/10001',
        viewDetailsUrl: `https://marine-licensing.defra.gov.uk/marine-licence/view-details/${mockMarineLicenceId}`,
        projectType: 'marine-licence'
      })
    })
  })

  describe('Response Format', () => {
    it('should return application reference and submission timestamp', async () => {
      const mockMarineLicence = {
        _id: ObjectId.createFromHexString(mockMarineLicenceId),
        contactId: 'test-contact-id',
        projectName: 'Test Project'
      }

      mockMarineLicencesCollection.findOne.mockResolvedValue(mockMarineLicence)
      mockMarineLicencesCollection.updateOne.mockResolvedValue({
        matchedCount: 1
      })

      await submitMarineLicenceController.handler(
        {
          payload: { id: mockMarineLicenceId },
          db: mockDb,
          locker: mockLocker,
          auth: mockAuth,
          logger: mockLogger
        },
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith({
        message: 'success',
        value: {
          applicationReference: 'MLA/2025/10001',
          submittedAt: expect.stringMatching(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
          )
        }
      })

      expect(mockHandler.code).toHaveBeenCalledWith(200)
    })
  })

  describe('Error Handling - Already Submitted', () => {
    it('should prevent duplicate submission', async () => {
      const mockSubmittedMarineLicence = {
        _id: ObjectId.createFromHexString(mockMarineLicenceId),
        contactId: 'test-contact-id',
        projectName: 'Test Project',
        applicationReference: 'MLA/2025/10001',
        submittedAt: new Date('2025-06-01'),
        status: MARINE_LICENCE_STATUS.SUBMITTED
      }

      mockMarineLicencesCollection.findOne.mockResolvedValue(
        mockSubmittedMarineLicence
      )

      await expect(
        submitMarineLicenceController.handler(
          {
            payload: { id: mockMarineLicenceId },
            db: mockDb,
            locker: mockLocker,
            auth: mockAuth,
            logger: mockLogger
          },
          mockHandler
        )
      ).rejects.toThrow(
        Boom.conflict('Marine licence has already been submitted')
      )

      expect(generateApplicationReference).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling - Incomplete Marine Licence', () => {
    it('should prevent submission when task is not completed', async () => {
      const mockIncompleteMarineLicence = {
        _id: ObjectId.createFromHexString(mockMarineLicenceId),
        contactId: 'test-contact-id'
      }

      createTaskList.mockReturnValue({
        projectName: 'INCOMPLETE'
      })

      mockMarineLicencesCollection.findOne.mockResolvedValue(
        mockIncompleteMarineLicence
      )

      await expect(
        submitMarineLicenceController.handler(
          {
            payload: { id: mockMarineLicenceId },
            db: mockDb,
            locker: mockLocker,
            auth: mockAuth,
            logger: mockLogger
          },
          mockHandler
        )
      ).rejects.toThrow(
        Boom.badRequest(
          'Marine licence is incomplete. Missing sections: projectName'
        )
      )

      expect(generateApplicationReference).not.toHaveBeenCalled()
    })

    it('should prevent submission with multiple incomplete sections', async () => {
      const mockIncompleteMarineLicence = {
        _id: ObjectId.createFromHexString(mockMarineLicenceId),
        contactId: 'test-contact-id'
      }

      createTaskList.mockReturnValue({
        projectName: 'INCOMPLETE',
        activityDescription: 'NOT_STARTED'
      })

      mockMarineLicencesCollection.findOne.mockResolvedValue(
        mockIncompleteMarineLicence
      )

      await expect(
        submitMarineLicenceController.handler(
          {
            payload: { id: mockMarineLicenceId },
            db: mockDb,
            locker: mockLocker,
            auth: mockAuth,
            logger: mockLogger
          },
          mockHandler
        )
      ).rejects.toThrow(
        Boom.badRequest(
          'Marine licence is incomplete. Missing sections: projectName, activityDescription'
        )
      )
    })

    it('should automatically check any new tasks added to task list', async () => {
      const mockIncompleteMarineLicence = {
        _id: ObjectId.createFromHexString(mockMarineLicenceId),
        contactId: 'test-contact-id',
        projectName: 'Test Project'
      }

      createTaskList.mockReturnValue({
        projectName: 'COMPLETED',
        newFutureTask: 'IN_PROGRESS'
      })

      mockMarineLicencesCollection.findOne.mockResolvedValue(
        mockIncompleteMarineLicence
      )

      await expect(
        submitMarineLicenceController.handler(
          {
            payload: { id: mockMarineLicenceId },
            db: mockDb,
            locker: mockLocker,
            auth: mockAuth,
            logger: mockLogger
          },
          mockHandler
        )
      ).rejects.toThrow(
        Boom.badRequest(
          'Marine licence is incomplete. Missing sections: newFutureTask'
        )
      )

      expect(generateApplicationReference).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling - Not Found', () => {
    it('should throw 404 when marine licence does not exist', async () => {
      mockMarineLicencesCollection.findOne.mockResolvedValue(null)

      await expect(
        submitMarineLicenceController.handler(
          {
            payload: { id: mockMarineLicenceId },
            db: mockDb,
            locker: mockLocker,
            auth: mockAuth,
            logger: mockLogger
          },
          mockHandler
        )
      ).rejects.toThrow(Boom.notFound('Marine Licence not found'))

      expect(generateApplicationReference).not.toHaveBeenCalled()
    })

    it('should throw 404 when marine licence is not found during update', async () => {
      const mockMarineLicence = {
        _id: ObjectId.createFromHexString(mockMarineLicenceId),
        contactId: 'test-contact-id',
        projectName: 'Test Project'
      }

      mockMarineLicencesCollection.findOne.mockResolvedValue(mockMarineLicence)
      mockMarineLicencesCollection.updateOne.mockResolvedValue({
        matchedCount: 0
      })

      await expect(
        submitMarineLicenceController.handler(
          {
            payload: { id: mockMarineLicenceId },
            db: mockDb,
            locker: mockLocker,
            auth: mockAuth,
            logger: mockLogger
          },
          mockHandler
        )
      ).rejects.toThrow(Boom.notFound('Marine licence not found during update'))
    })
  })

  describe('Error Handling - Reference Generation Failures', () => {
    it('should handle reference generation errors', async () => {
      const mockMarineLicence = {
        _id: ObjectId.createFromHexString(mockMarineLicenceId),
        contactId: 'test-contact-id',
        projectName: 'Test Project'
      }

      mockMarineLicencesCollection.findOne.mockResolvedValue(mockMarineLicence)
      generateApplicationReference.mockRejectedValue(
        Boom.internal('Unable to acquire lock for reference generation')
      )

      await expect(
        submitMarineLicenceController.handler(
          {
            payload: { id: mockMarineLicenceId },
            db: mockDb,
            locker: mockLocker,
            auth: mockAuth,
            logger: mockLogger
          },
          mockHandler
        )
      ).rejects.toThrow('Unable to acquire lock for reference generation')

      expect(mockMarineLicencesCollection.updateOne).not.toHaveBeenCalled()
    })

    it('should handle database connection errors during reference generation', async () => {
      const mockMarineLicence = {
        _id: ObjectId.createFromHexString(mockMarineLicenceId),
        contactId: 'test-contact-id',
        projectName: 'Test Project'
      }

      mockMarineLicencesCollection.findOne.mockResolvedValue(mockMarineLicence)
      generateApplicationReference.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(
        submitMarineLicenceController.handler(
          {
            payload: { id: mockMarineLicenceId },
            db: mockDb,
            locker: mockLocker,
            auth: mockAuth,
            logger: mockLogger
          },
          mockHandler
        )
      ).rejects.toThrow(
        Boom.internal(
          'Error submitting marine licence: Database connection failed'
        )
      )
    })
  })

  describe('Dynamics Queue', () => {
    it('should call addToDynamicsQueue with marineLicence type when Dynamics is enabled', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'dynamics') return { isDynamicsEnabled: true }
        if (key === 'frontEndBaseUrl') {
          return 'https://marine-licensing.defra.gov.uk'
        }
        return {}
      })

      const mockMarineLicence = {
        _id: ObjectId.createFromHexString(mockMarineLicenceId),
        contactId: 'test-contact-id',
        projectName: 'Test Marine Project'
      }

      mockMarineLicencesCollection.findOne.mockResolvedValue(mockMarineLicence)
      mockMarineLicencesCollection.updateOne.mockResolvedValue({
        matchedCount: 1
      })

      const mockRequest = {
        payload: { id: mockMarineLicenceId, ...mockAuditPayload },
        db: mockDb,
        locker: mockLocker,
        auth: mockAuth,
        logger: mockLogger
      }

      await submitMarineLicenceController.handler(mockRequest, mockHandler)

      expect(addToDynamicsQueue).toHaveBeenCalledWith({
        request: mockRequest,
        applicationReference: 'MLA/2025/10001',
        action: DYNAMICS_REQUEST_ACTIONS.SUBMIT,
        type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE
      })
    })

    it('should not call addToDynamicsQueue when Dynamics is disabled', async () => {
      config.get.mockReturnValue({ isDynamicsEnabled: false })

      const mockMarineLicence = {
        _id: ObjectId.createFromHexString(mockMarineLicenceId),
        contactId: 'test-contact-id',
        projectName: 'Test Marine Project'
      }

      mockMarineLicencesCollection.findOne.mockResolvedValue(mockMarineLicence)
      mockMarineLicencesCollection.updateOne.mockResolvedValue({
        matchedCount: 1
      })

      await submitMarineLicenceController.handler(
        {
          payload: { id: mockMarineLicenceId, ...mockAuditPayload },
          db: mockDb,
          locker: mockLocker,
          auth: mockAuth,
          logger: mockLogger
        },
        mockHandler
      )

      expect(addToDynamicsQueue).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling - Database Operations', () => {
    it('should handle database errors during marine licence lookup', async () => {
      mockMarineLicencesCollection.findOne.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(
        submitMarineLicenceController.handler(
          {
            payload: { id: mockMarineLicenceId },
            db: mockDb,
            locker: mockLocker,
            auth: mockAuth,
            logger: mockLogger
          },
          mockHandler
        )
      ).rejects.toThrow(
        Boom.internal(
          'Error submitting marine licence: Database connection failed'
        )
      )
    })

    it('should handle database errors during marine licence update', async () => {
      const mockMarineLicence = {
        _id: ObjectId.createFromHexString(mockMarineLicenceId),
        contactId: 'test-contact-id',
        projectName: 'Test Project'
      }

      mockMarineLicencesCollection.findOne.mockResolvedValue(mockMarineLicence)
      mockMarineLicencesCollection.updateOne.mockRejectedValue(
        new Error('Database update failed')
      )

      await expect(
        submitMarineLicenceController.handler(
          {
            payload: { id: mockMarineLicenceId },
            db: mockDb,
            locker: mockLocker,
            auth: mockAuth,
            logger: mockLogger
          },
          mockHandler
        )
      ).rejects.toThrow(
        Boom.internal('Error submitting marine licence: Database update failed')
      )
    })
  })
})
