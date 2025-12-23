import { vi } from 'vitest'
import { submitExemptionController } from './submit-exemption.js'
import { generateApplicationReference } from '../helpers/reference-generator.js'
import { createTaskList } from '../helpers/createTaskList.js'
import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import { EXEMPTION_STATUS } from '../../../common/constants/exemption.js'
import { REQUEST_QUEUE_STATUS } from '../../../common/constants/request-queue.js'
import { config } from '../../../config.js'
import { updateMarinePlanningAreas } from '../../../common/helpers/geo/update-marine-planning-areas.js'
import { updateCoastalEnforcementAreas } from '../../../common/helpers/geo/update-coastal-enforcement-areas.js'

vi.mock('notifications-node-client', () => ({
  NotifyClient: vi.fn().mockImplementation(function () {
    return {
      sendEmail: vi.fn()
    }
  })
}))
vi.mock('../helpers/reference-generator.js')
vi.mock('../helpers/createTaskList.js')
vi.mock('../helpers/send-user-email-confirmation.js')
vi.mock('../../../config.js')
vi.mock('../../../common/helpers/geo/update-coastal-enforcement-areas.js')
vi.mock('../../../common/helpers/geo/update-marine-planning-areas.js')

describe('POST /exemption/submit', () => {
  let mockDb
  let mockLocker
  let mockHandler
  let mockExemptionId
  let mockDate
  let mockServer

  const mockAuditPayload = {
    createdAt: new Date('2025-01-01T12:00:00Z'),
    createdBy: 'user123',
    updatedAt: new Date('2025-02-01T12:00:00Z'),
    updatedBy: 'user123',
    userName: 'John Doe'
  }

  beforeEach(() => {
    vi.resetAllMocks()

    config.get.mockImplementation(function (key) {
      if (key === 'dynamics') {
        return {
          isDynamicsEnabled: true,
          apiKey: 'test-api-key',
          retryIntervalSeconds: 1,
          retries: 1
        }
      }
      if (key === 'exploreMarinePlanning') {
        return {
          isEmpEnabled: true,
          apiKey: 'test-api-key',
          retryIntervalSeconds: 1,
          retries: 1
        }
      }
      if (key === 'frontEndBaseUrl') {
        return 'http://localhost:3000'
      }
      return {}
    })

    mockDate = new Date('2025-06-15T10:30:00Z')
    vi.spyOn(global, 'Date').mockImplementation(function () {
      return mockDate
    })
    Date.now = vi.fn(() => mockDate.getTime())

    mockExemptionId = new ObjectId().toHexString()

    mockHandler = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    mockDb = {
      collection: vi.fn().mockReturnValue({
        findOne: vi.fn(),
        updateOne: vi.fn(),
        insertOne: vi.fn()
      })
    }

    mockLocker = {
      lock: vi.fn()
    }

    mockServer = {
      logger: {
        error: vi.fn()
      },
      methods: {
        processDynamicsQueue: vi.fn().mockResolvedValue(undefined),
        processEmpQueue: vi.fn().mockResolvedValue(undefined)
      }
    }

    generateApplicationReference.mockResolvedValue('EXE/2025/10001')
    createTaskList.mockReturnValue({
      projectName: 'COMPLETED',
      publicRegister: 'COMPLETED',
      siteDetails: 'COMPLETED',
      activityDescription: 'COMPLETED'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Payload Validation', () => {
    it('should validate required exemption ID', () => {
      const payloadValidator =
        submitExemptionController.options.validate.payload

      const result = payloadValidator.validate({})

      expect(result.error.message).toContain('EXEMPTION_ID_REQUIRED')
    })

    it('should validate exemption ID format', () => {
      const payloadValidator =
        submitExemptionController.options.validate.payload

      const result = payloadValidator.validate({ id: 'invalid-id' })

      expect(result.error.message).toContain('EXEMPTION_ID_REQUIRED')
    })

    it('should accept valid request payload', () => {
      const payloadValidator =
        submitExemptionController.options.validate.payload

      const result = payloadValidator.validate({
        id: mockExemptionId,
        userName: 'John Doe',
        userEmail: 'john.doe@example.com'
      })

      expect(result.error).toBeUndefined()
    })
  })

  describe('Happy Path - Successful Submission', () => {
    it('should submit complete exemption and generate application reference', async () => {
      const mockExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Marine Project',
        publicRegister: { consent: 'no' },
        multipleSiteDetails: { multipleSitesEnabled: false },
        siteDetails: [
          {
            coordinatesType: 'point',
            coordinates: { latitude: '54.978', longitude: '-1.617' }
          }
        ],
        activityDescription: 'Test marine activity'
      }

      mockDb.collection().findOne.mockResolvedValue(mockExemption)
      mockDb.collection().updateOne.mockResolvedValue({ matchedCount: 1 })

      await submitExemptionController.handler(
        {
          payload: { id: mockExemptionId, ...mockAuditPayload },
          db: mockDb,
          locker: mockLocker,
          server: mockServer
        },
        mockHandler
      )

      expect(generateApplicationReference).toHaveBeenCalledWith(
        mockDb,
        mockLocker,
        'EXEMPTION'
      )

      expect(updateCoastalEnforcementAreas).toHaveBeenCalledWith(
        mockExemption,
        mockDb,
        {
          updatedAt: mockAuditPayload.updatedAt,
          updatedBy: mockAuditPayload.updatedBy
        }
      )

      expect(updateMarinePlanningAreas).toHaveBeenCalledWith(
        mockExemption,
        mockDb,
        {
          updatedAt: mockAuditPayload.updatedAt,
          updatedBy: mockAuditPayload.updatedBy
        }
      )

      expect(mockDb.collection().updateOne).toHaveBeenCalledWith(
        { _id: ObjectId.createFromHexString(mockExemptionId) },
        {
          $set: {
            applicationReference: 'EXE/2025/10001',
            multipleSiteDetails: {
              multipleSitesEnabled: false
            },
            submittedAt: mockDate,
            status: EXEMPTION_STATUS.ACTIVE,
            updatedAt: mockAuditPayload.updatedAt,
            updatedBy: mockAuditPayload.updatedBy
          }
        }
      )

      expect(mockHandler.response).toHaveBeenCalledWith({
        message: 'success',
        value: {
          applicationReference: 'EXE/2025/10001',
          submittedAt: expect.any(String)
        }
      })

      expect(mockHandler.code).toHaveBeenCalledWith(200)

      expect(mockServer.methods.processDynamicsQueue).toHaveBeenCalled()
      expect(mockServer.methods.processEmpQueue).toHaveBeenCalled()
    })

    it('should insert request queue document when exemption is submitted', async () => {
      const mockExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Marine Project',
        publicRegister: { consent: 'no' },
        multipleSiteDetails: { multipleSitesEnabled: false },
        siteDetails: [
          {
            coordinatesType: 'point',
            coordinates: { latitude: '54.978', longitude: '-1.617' }
          }
        ],
        activityDescription: 'Test marine activity'
      }

      mockDb.collection().findOne.mockResolvedValue(mockExemption)
      mockDb.collection().updateOne.mockResolvedValue({ matchedCount: 1 })
      mockDb
        .collection()
        .insertOne.mockResolvedValue({ insertedId: new ObjectId() })

      await submitExemptionController.handler(
        {
          payload: { id: mockExemptionId, ...mockAuditPayload },
          db: mockDb,
          locker: mockLocker,
          server: mockServer
        },
        mockHandler
      )

      expect(updateCoastalEnforcementAreas).toHaveBeenCalledWith(
        mockExemption,
        mockDb,
        {
          updatedAt: mockAuditPayload.updatedAt,
          updatedBy: mockAuditPayload.updatedBy
        }
      )

      expect(updateMarinePlanningAreas).toHaveBeenCalledWith(
        mockExemption,
        mockDb,
        {
          updatedAt: mockAuditPayload.updatedAt,
          updatedBy: mockAuditPayload.updatedBy
        }
      )

      expect(mockDb.collection).toHaveBeenCalledWith('exemption-dynamics-queue')
      expect(mockDb.collection).toHaveBeenCalledWith('exemption-emp-queue')
      expect(mockDb.collection().insertOne).toHaveBeenCalledWith({
        applicationReferenceNumber: 'EXE/2025/10001',
        status: REQUEST_QUEUE_STATUS.PENDING,
        retries: 0,
        ...mockAuditPayload
      })
    })

    it('should log error and continue submit request if there is an error in request queue', async () => {
      const mockExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Marine Project',
        publicRegister: { consent: 'no' },
        multipleSiteDetails: { multipleSitesEnabled: false },
        siteDetails: [
          {
            coordinatesType: 'point',
            coordinates: { latitude: '54.978', longitude: '-1.617' }
          }
        ],
        activityDescription: 'Test marine activity'
      }

      mockDb.collection().findOne.mockResolvedValue(mockExemption)
      mockDb.collection().updateOne.mockResolvedValue({ matchedCount: 1 })
      mockDb
        .collection()
        .insertOne.mockResolvedValue({ insertedId: new ObjectId() })

      mockServer.methods.processDynamicsQueue.mockRejectedValueOnce(
        'Test error'
      )
      mockServer.methods.processEmpQueue.mockRejectedValueOnce('Test error')

      await submitExemptionController.handler(
        {
          payload: { id: mockExemptionId, ...mockAuditPayload },
          db: mockDb,
          locker: mockLocker,
          server: mockServer
        },
        mockHandler
      )

      expect(mockServer.methods.processDynamicsQueue).toHaveBeenCalled()
      expect(mockServer.methods.processEmpQueue).toHaveBeenCalled()

      expect(mockServer.logger.error).toHaveBeenCalledWith(
        'Failed to process dynamics queue, but exemption submission succeeded'
      )
      expect(mockServer.logger.error).toHaveBeenCalledWith(
        'Failed to process EMP queue, but exemption submission succeeded'
      )

      expect(mockHandler.code).toHaveBeenCalledWith(200)
    })

    it('should not insert request queue document when dynamics and EMP are not enabled when exemption is submitted', async () => {
      const mockExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Marine Project',
        publicRegister: { consent: 'no' },
        multipleSiteDetails: { multipleSitesEnabled: false },
        siteDetails: [
          {
            coordinatesType: 'point',
            coordinates: { latitude: '54.978', longitude: '-1.617' }
          }
        ],
        activityDescription: 'Test marine activity'
      }

      config.get.mockReturnValue({
        isDynamicsEnabled: false,
        isEmpEnabled: false
      })

      mockDb.collection().findOne.mockResolvedValue(mockExemption)
      mockDb.collection().updateOne.mockResolvedValue({ matchedCount: 1 })

      await submitExemptionController.handler(
        {
          payload: { id: mockExemptionId },
          db: mockDb,
          locker: mockLocker,
          server: mockServer
        },
        mockHandler
      )

      expect(mockDb.collection().insertOne).not.toHaveBeenCalled()
    })

    it('should insert dynamics and EMP queue documents regardless of organisation', async () => {
      const mockExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Marine Project',
        organisation: {
          id: 'org-123',
          name: 'Test Organisation',
          userRelationshipType: 'Employee'
        },
        publicRegister: { consent: 'no' },
        multipleSiteDetails: { multipleSitesEnabled: false },
        siteDetails: [
          {
            coordinatesType: 'point',
            coordinates: { latitude: '54.978', longitude: '-1.617' }
          }
        ],
        activityDescription: 'Test marine activity'
      }

      mockDb.collection().findOne.mockResolvedValue(mockExemption)
      mockDb.collection().updateOne.mockResolvedValue({ matchedCount: 1 })
      mockDb
        .collection()
        .insertOne.mockResolvedValue({ insertedId: new ObjectId() })

      await submitExemptionController.handler(
        {
          payload: { id: mockExemptionId, ...mockAuditPayload },
          db: mockDb,
          locker: mockLocker,
          server: mockServer
        },
        mockHandler
      )

      expect(mockDb.collection).toHaveBeenCalledWith('exemption-dynamics-queue')
      expect(mockDb.collection).toHaveBeenCalledWith('exemption-emp-queue')
      const { userName, ...rest } = mockAuditPayload
      expect(mockDb.collection().insertOne).toHaveBeenNthCalledWith(1, {
        applicationReferenceNumber: 'EXE/2025/10001',
        status: REQUEST_QUEUE_STATUS.PENDING,
        retries: 0,
        ...rest
      })
      expect(mockDb.collection().insertOne).toHaveBeenNthCalledWith(2, {
        applicationReferenceNumber: 'EXE/2025/10001',
        status: REQUEST_QUEUE_STATUS.PENDING,
        retries: 0,
        ...mockAuditPayload
      })
    })

    it('should validate task completion before submission', async () => {
      const mockExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Project',
        publicRegister: { consent: 'no' },
        multipleSiteDetails: { multipleSitesEnabled: false },
        siteDetails: [{ coordinatesType: 'point' }],
        activityDescription: 'Test activity'
      }

      mockDb.collection().findOne.mockResolvedValue(mockExemption)
      mockDb.collection().updateOne.mockResolvedValue({ matchedCount: 1 })

      await submitExemptionController.handler(
        {
          payload: { id: mockExemptionId },
          db: mockDb,
          locker: mockLocker,
          server: mockServer
        },
        mockHandler
      )

      expect(createTaskList).toHaveBeenCalledWith(mockExemption)
    })
  })

  describe('Error Handling - Exemption Not Found', () => {
    it('should throw 404 when exemption does not exist', async () => {
      mockDb.collection().findOne.mockResolvedValue(null)

      await expect(
        submitExemptionController.handler(
          {
            payload: { id: mockExemptionId },
            db: mockDb,
            locker: mockLocker,
            server: mockServer
          },
          mockHandler
        )
      ).rejects.toThrow(Boom.notFound('Exemption not found'))

      expect(generateApplicationReference).not.toHaveBeenCalled()
    })

    it('should throw 404 when exemption is not found during update', async () => {
      const mockExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Project',
        publicRegister: { consent: 'no' },
        multipleSiteDetails: { multipleSitesEnabled: false },
        siteDetails: [{ coordinatesType: 'point' }],
        activityDescription: 'Test activity'
      }

      mockDb.collection().findOne.mockResolvedValue(mockExemption)
      mockDb.collection().updateOne.mockResolvedValue({ matchedCount: 0 })

      await expect(
        submitExemptionController.handler(
          {
            payload: { id: mockExemptionId },
            db: mockDb,
            locker: mockLocker,
            server: mockServer
          },
          mockHandler
        )
      ).rejects.toThrow(Boom.notFound('Exemption not found during update'))
    })
  })

  describe('Error Handling - Already Submitted', () => {
    it('should prevent duplicate submission of same exemption', async () => {
      const mockSubmittedExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Project',
        applicationReference: 'EXE/2025/10001',
        submittedAt: new Date('2025-06-01'),
        status: EXEMPTION_STATUS.ACTIVE
      }

      mockDb.collection().findOne.mockResolvedValue(mockSubmittedExemption)

      await expect(
        submitExemptionController.handler(
          {
            payload: { id: mockExemptionId },
            db: mockDb,
            locker: mockLocker,
            server: mockServer
          },
          mockHandler
        )
      ).rejects.toThrow(Boom.conflict('Exemption has already been submitted'))

      expect(generateApplicationReference).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling - Incomplete Exemption', () => {
    it('should prevent submission of incomplete exemption - task not completed', async () => {
      const mockIncompleteExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        publicRegister: { consent: 'no' },
        multipleSiteDetails: { multipleSitesEnabled: false },
        siteDetails: [{ coordinatesType: 'point' }],
        activityDescription: 'Test activity'
      }

      createTaskList.mockReturnValue({
        projectName: 'IN_PROGRESS',
        publicRegister: 'COMPLETED',
        siteDetails: 'COMPLETED',
        activityDescription: 'COMPLETED'
      })

      mockDb.collection().findOne.mockResolvedValue(mockIncompleteExemption)

      await expect(
        submitExemptionController.handler(
          {
            payload: { id: mockExemptionId },
            db: mockDb,
            locker: mockLocker,
            server: mockServer
          },
          mockHandler
        )
      ).rejects.toThrow(
        Boom.badRequest(
          'Exemption is incomplete. Missing sections: projectName'
        )
      )

      expect(generateApplicationReference).not.toHaveBeenCalled()
    })

    it('should prevent submission with multiple incomplete sections', async () => {
      const mockIncompleteExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Project'
      }

      createTaskList.mockReturnValue({
        projectName: 'COMPLETED',
        publicRegister: 'IN_PROGRESS',
        siteDetails: 'NOT_STARTED',
        activityDescription: null
      })

      mockDb.collection().findOne.mockResolvedValue(mockIncompleteExemption)

      await expect(
        submitExemptionController.handler(
          {
            payload: { id: mockExemptionId },
            db: mockDb,
            locker: mockLocker,
            server: mockServer
          },
          mockHandler
        )
      ).rejects.toThrow(
        Boom.badRequest(
          'Exemption is incomplete. Missing sections: publicRegister, siteDetails, activityDescription'
        )
      )
    })

    it('should require all tasks to be completed for submission', async () => {
      const mockIncompleteExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Project',
        publicRegister: { consent: 'no' }
      }

      createTaskList.mockReturnValue({
        projectName: 'COMPLETED',
        publicRegister: 'COMPLETED',
        siteDetails: 'IN_PROGRESS',
        activityDescription: null
      })

      mockDb.collection().findOne.mockResolvedValue(mockIncompleteExemption)

      await expect(
        submitExemptionController.handler(
          {
            payload: { id: mockExemptionId },
            db: mockDb,
            locker: mockLocker,
            server: mockServer
          },
          mockHandler
        )
      ).rejects.toThrow(
        Boom.badRequest(
          'Exemption is incomplete. Missing sections: siteDetails, activityDescription'
        )
      )
    })

    it('should automatically check any new tasks added to task list', async () => {
      const mockIncompleteExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Project',
        publicRegister: { consent: 'no' },
        multipleSiteDetails: { multipleSitesEnabled: false },
        siteDetails: [{ coordinatesType: 'point' }],
        activityDescription: 'Test activity'
      }

      createTaskList.mockReturnValue({
        projectName: 'COMPLETED',
        publicRegister: 'COMPLETED',
        siteDetails: 'COMPLETED',
        activityDescription: 'COMPLETED',
        newFutureTask: 'IN_PROGRESS'
      })

      mockDb.collection().findOne.mockResolvedValue(mockIncompleteExemption)

      await expect(
        submitExemptionController.handler(
          {
            payload: { id: mockExemptionId },
            db: mockDb,
            locker: mockLocker,
            server: mockServer
          },
          mockHandler
        )
      ).rejects.toThrow(
        Boom.badRequest(
          'Exemption is incomplete. Missing sections: newFutureTask'
        )
      )

      expect(generateApplicationReference).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling - Reference Generation Failures', () => {
    it('should handle reference generation errors', async () => {
      const mockExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Project',
        publicRegister: { consent: 'no' },
        multipleSiteDetails: { multipleSitesEnabled: false },
        siteDetails: [{ coordinatesType: 'point' }],
        activityDescription: 'Test activity'
      }

      mockDb.collection().findOne.mockResolvedValue(mockExemption)
      generateApplicationReference.mockRejectedValue(
        Boom.internal('Unable to acquire lock for reference generation')
      )

      await expect(
        submitExemptionController.handler(
          {
            payload: { id: mockExemptionId },
            db: mockDb,
            locker: mockLocker,
            server: mockServer
          },
          mockHandler
        )
      ).rejects.toThrow('Unable to acquire lock for reference generation')

      expect(mockDb.collection().updateOne).not.toHaveBeenCalled()
    })

    it('should handle database connection errors during reference generation', async () => {
      const mockExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Project',
        publicRegister: { consent: 'no' },
        multipleSiteDetails: { multipleSitesEnabled: false },
        siteDetails: [{ coordinatesType: 'point' }],
        activityDescription: 'Test activity'
      }

      mockDb.collection().findOne.mockResolvedValue(mockExemption)
      generateApplicationReference.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(
        submitExemptionController.handler(
          {
            payload: { id: mockExemptionId },
            db: mockDb,
            locker: mockLocker,
            server: mockServer
          },
          mockHandler
        )
      ).rejects.toThrow(
        Boom.internal('Error submitting exemption: Database connection failed')
      )
    })
  })

  describe('Error Handling - Database Operations', () => {
    it('should handle database errors during exemption lookup', async () => {
      mockDb
        .collection()
        .findOne.mockRejectedValue(new Error('Database connection failed'))

      await expect(
        submitExemptionController.handler(
          {
            payload: { id: mockExemptionId },
            db: mockDb,
            locker: mockLocker,
            server: mockServer
          },
          mockHandler
        )
      ).rejects.toThrow(
        Boom.internal('Error submitting exemption: Database connection failed')
      )
    })

    it('should handle database errors during exemption update', async () => {
      const mockExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Project',
        publicRegister: { consent: 'no' },
        multipleSiteDetails: { multipleSitesEnabled: false },
        siteDetails: [{ coordinatesType: 'point' }],
        activityDescription: 'Test activity'
      }

      mockDb.collection().findOne.mockResolvedValue(mockExemption)
      mockDb
        .collection()
        .updateOne.mockRejectedValue(new Error('Database update failed'))

      await expect(
        submitExemptionController.handler(
          {
            payload: { id: mockExemptionId },
            db: mockDb,
            locker: mockLocker,
            server: mockServer
          },
          mockHandler
        )
      ).rejects.toThrow(
        Boom.internal('Error submitting exemption: Database update failed')
      )
    })
  })

  describe('Integration - Reference Generation Workflow', () => {
    it('should pass correct parameters to reference generator', async () => {
      const mockExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Project',
        publicRegister: { consent: 'no' },
        multipleSiteDetails: { multipleSitesEnabled: false },
        siteDetails: [{ coordinatesType: 'point' }],
        activityDescription: 'Test activity'
      }

      mockDb.collection().findOne.mockResolvedValue(mockExemption)
      mockDb.collection().updateOne.mockResolvedValue({ matchedCount: 1 })

      await submitExemptionController.handler(
        {
          payload: { id: mockExemptionId },
          db: mockDb,
          locker: mockLocker,
          server: mockServer
        },
        mockHandler
      )

      expect(generateApplicationReference).toHaveBeenCalledWith(
        mockDb,
        mockLocker,
        'EXEMPTION'
      )
    })

    it('should save generated reference to exemption document', async () => {
      const mockExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Project',
        publicRegister: { consent: 'no' },
        multipleSiteDetails: { multipleSitesEnabled: false },
        siteDetails: [{ coordinatesType: 'point' }],
        activityDescription: 'Test activity'
      }

      const expectedReference = 'EXE/2025/12345'
      generateApplicationReference.mockResolvedValue(expectedReference)

      mockDb.collection().findOne.mockResolvedValue(mockExemption)
      mockDb.collection().updateOne.mockResolvedValue({ matchedCount: 1 })

      await submitExemptionController.handler(
        {
          payload: { id: mockExemptionId },
          db: mockDb,
          locker: mockLocker,
          server: mockServer
        },
        mockHandler
      )

      expect(mockDb.collection().updateOne).toHaveBeenCalledWith(
        { _id: ObjectId.createFromHexString(mockExemptionId) },
        {
          $set: {
            applicationReference: expectedReference,
            multipleSiteDetails: {
              multipleSitesEnabled: false
            },
            submittedAt: mockDate,
            status: EXEMPTION_STATUS.ACTIVE
          }
        }
      )
    })
  })

  describe('Response Format', () => {
    it('should return application reference and submission timestamp', async () => {
      const mockExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Project',
        publicRegister: { consent: 'no' },
        multipleSiteDetails: { multipleSitesEnabled: false },
        siteDetails: [{ coordinatesType: 'point' }],
        activityDescription: 'Test activity'
      }

      mockDb.collection().findOne.mockResolvedValue(mockExemption)
      mockDb.collection().updateOne.mockResolvedValue({ matchedCount: 1 })

      await submitExemptionController.handler(
        {
          payload: { id: mockExemptionId },
          db: mockDb,
          locker: mockLocker,
          server: mockServer
        },
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith({
        message: 'success',
        value: {
          applicationReference: 'EXE/2025/10001',
          submittedAt: expect.stringMatching(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
          )
        }
      })

      expect(mockHandler.code).toHaveBeenCalledWith(200)
    })
  })

  describe('Business Rules - Reference Only on Submission', () => {
    it('should not generate reference for draft exemptions', async () => {
      const mockDraftExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Project',
        publicRegister: { consent: 'no' },
        multipleSiteDetails: { multipleSitesEnabled: false },
        siteDetails: [{ coordinatesType: 'point' }],
        activityDescription: 'Test activity',
        status: 'draft'
      }

      mockDb.collection().findOne.mockResolvedValue(mockDraftExemption)
      mockDb.collection().updateOne.mockResolvedValue({ matchedCount: 1 })

      await submitExemptionController.handler(
        {
          payload: { id: mockExemptionId },
          db: mockDb,
          locker: mockLocker,
          server: mockServer
        },
        mockHandler
      )

      expect(generateApplicationReference).toHaveBeenCalled()
      expect(mockDb.collection().updateOne).toHaveBeenCalledWith(
        { _id: ObjectId.createFromHexString(mockExemptionId) },
        {
          $set: {
            applicationReference: 'EXE/2025/10001',
            multipleSiteDetails: {
              multipleSitesEnabled: false
            },
            submittedAt: mockDate,
            status: EXEMPTION_STATUS.ACTIVE
          }
        }
      )
    })
  })

  describe('Business Rules - Change multi site choice when one site', () => {
    it('Change multi site choice when one site', async () => {
      const mockDraftExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        projectName: 'Test Project',
        publicRegister: { consent: 'no' },
        multipleSiteDetails: { multipleSitesEnabled: true },
        siteDetails: [{ coordinatesType: 'point' }],
        activityDescription: 'Test activity',
        status: 'draft'
      }

      mockDb.collection().findOne.mockResolvedValue(mockDraftExemption)
      mockDb.collection().updateOne.mockResolvedValue({ matchedCount: 1 })

      await submitExemptionController.handler(
        {
          payload: { id: mockExemptionId },
          db: mockDb,
          locker: mockLocker,
          server: mockServer
        },
        mockHandler
      )

      expect(generateApplicationReference).toHaveBeenCalled()
      expect(mockDb.collection().updateOne).toHaveBeenCalledWith(
        { _id: ObjectId.createFromHexString(mockExemptionId) },
        {
          $set: {
            applicationReference: 'EXE/2025/10001',
            multipleSiteDetails: {
              multipleSitesEnabled: false
            },
            submittedAt: mockDate,
            status: EXEMPTION_STATUS.ACTIVE
          }
        }
      )
    })
  })
})
