import { vi } from 'vitest'
import { sendToEmpController } from './send-to-emp.js'
import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import { config } from '../../../config.js'
import { addToEmpQueue } from '../../../common/helpers/emp/emp-processor.js'

vi.mock('../../../config.js')
vi.mock('../../../common/helpers/emp/emp-processor.js')
vi.mock('../../../common/helpers/dynamics/get-contact-details.js', () => ({
  getContactNameById: vi.fn().mockResolvedValue('Test Contact Name')
}))

describe('POST /exemption/send-to-emp', () => {
  let mockDb
  let mockHandler
  let mockExemptionId
  let mockServer
  let mockLogger

  const dbExemption = {
    createdAt: new Date('2025-01-01T12:00:00Z'),
    createdBy: 'user123',
    updatedAt: new Date('2025-02-01T12:00:00Z'),
    updatedBy: 'user123',
    organisation: { name: 'Dredging Co' }
  }

  beforeEach(() => {
    config.get.mockImplementation(function (key) {
      if (key === 'exploreMarinePlanning') {
        return {
          isEmpEnabled: true
        }
      }
      return {}
    })

    mockExemptionId = new ObjectId().toHexString()

    mockHandler = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockDb = {
      collection: vi.fn().mockReturnValue({
        findOne: vi.fn(),
        insertOne: vi.fn()
      })
    }

    mockServer = {
      logger: mockLogger,
      methods: {
        processEmpQueue: vi.fn().mockResolvedValue(undefined)
      }
    }

    addToEmpQueue.mockResolvedValue(undefined)
  })

  describe('Validation', () => {
    it('should have correct validation schema', () => {
      const { validate } = sendToEmpController.options

      expect(validate.payload).toBeDefined()

      const { error } = validate.payload.validate({ id: mockExemptionId })
      expect(error).toBeUndefined()
    })

    it('should require id field', () => {
      const { validate } = sendToEmpController.options
      const { error } = validate.payload.validate({})

      expect(error).toBeDefined()
      expect(error.details[0].context.label).toBe('id')
    })

    it('should reject invalid id format', () => {
      const { validate } = sendToEmpController.options
      const { error } = validate.payload.validate({ id: 'invalid-id' })

      expect(error).toBeDefined()
      expect(error.details[0].context.label).toBe('id')
    })
  })

  describe('Handler', () => {
    it('should successfully send exemption to EMP queue', async () => {
      const mockExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        applicationReference: 'APP-2025-001',
        ...dbExemption
      }

      mockDb.collection().findOne.mockResolvedValue(mockExemption)

      const request = {
        payload: { id: mockExemptionId },
        db: mockDb,
        server: mockServer,
        logger: mockLogger
      }

      await sendToEmpController.handler(request, mockHandler)

      expect(mockDb.collection).toHaveBeenCalledWith('exemptions')
      expect(mockDb.collection().findOne).toHaveBeenCalledWith({
        _id: ObjectId.createFromHexString(mockExemptionId)
      })

      expect(addToEmpQueue).toHaveBeenCalledWith({
        request: expect.objectContaining({
          payload: expect.objectContaining({
            id: mockExemptionId,
            createdAt: dbExemption.createdAt,
            createdBy: dbExemption.createdBy,
            updatedAt: dbExemption.updatedAt,
            updatedBy: dbExemption.updatedBy
          })
        }),
        applicationReference: 'APP-2025-001',
        action: 'add'
      })

      expect(mockHandler.response).toHaveBeenCalledWith({
        message: 'success',
        value: {
          applicationReference: 'APP-2025-001',
          message: 'Exemption added to EMP queue'
        }
      })
      expect(mockHandler.code).toHaveBeenCalledWith(200)
    })

    it('should throw error if exemption not found', async () => {
      mockDb.collection().findOne.mockResolvedValue(null)

      const request = {
        payload: { id: mockExemptionId },
        db: mockDb,
        server: mockServer,
        logger: mockLogger
      }

      await expect(
        sendToEmpController.handler(request, mockHandler)
      ).rejects.toThrow(
        Boom.notFound(`#findExemptionById not found for id ${mockExemptionId}`)
      )
    })

    it('should throw error if exemption has not been submitted', async () => {
      const mockExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        ...dbExemption
      }

      mockDb.collection().findOne.mockResolvedValue(mockExemption)

      const request = {
        payload: { id: mockExemptionId },
        db: mockDb,
        server: mockServer,
        logger: mockLogger
      }

      await expect(
        sendToEmpController.handler(request, mockHandler)
      ).rejects.toThrow(Boom.badRequest('Exemption has not been submitted'))
    })

    it('should throw error if EMP is not enabled', async () => {
      config.get.mockImplementation(function (key) {
        if (key === 'exploreMarinePlanning') {
          return {
            isEmpEnabled: false
          }
        }
        return {}
      })

      const request = {
        payload: { id: mockExemptionId },
        db: mockDb,
        server: mockServer,
        logger: mockLogger
      }

      await expect(
        sendToEmpController.handler(request, mockHandler)
      ).rejects.toThrow(Boom.badRequest('EMP integration is not enabled'))
    })

    it('should throw error if the exemption is already in the queue', async () => {
      const mockExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        applicationReference: 'APP-2025-001',
        ...dbExemption
      }

      mockDb.collection().findOne.mockResolvedValue(mockExemption)
      addToEmpQueue.mockRejectedValue(
        Boom.conflict('Exemption APP-2025-001 already exists in EMP queue')
      )

      const request = {
        payload: { id: mockExemptionId },
        db: mockDb,
        server: mockServer,
        logger: mockLogger
      }

      await expect(
        sendToEmpController.handler(request, mockHandler)
      ).rejects.toThrow(
        Boom.conflict('Exemption APP-2025-001 already exists in EMP queue')
      )
    })

    it('should throw badImplementation error if addToEmpQueue fails', async () => {
      const mockExemption = {
        _id: ObjectId.createFromHexString(mockExemptionId),
        applicationReference: 'APP-2025-001',
        ...dbExemption
      }

      mockDb.collection().findOne.mockResolvedValue(mockExemption)
      addToEmpQueue.mockRejectedValue(new Error('Queue error'))

      const request = {
        payload: { id: mockExemptionId },
        db: mockDb,
        server: mockServer,
        logger: mockLogger
      }

      try {
        await sendToEmpController.handler(request, mockHandler)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error.isBoom).toBe(true)
        expect(error.output.statusCode).toBe(500)
        expect(error.message).toContain('Failed to send exemption to EMP')
      }
    })

    it('should re-throw Boom errors without wrapping', async () => {
      const boomError = Boom.unauthorized('Not authorized')
      mockDb.collection().findOne.mockRejectedValue(boomError)

      const request = {
        payload: { id: mockExemptionId },
        db: mockDb,
        server: mockServer,
        logger: mockLogger
      }

      await expect(
        sendToEmpController.handler(request, mockHandler)
      ).rejects.toThrow(boomError)
    })
  })
})
