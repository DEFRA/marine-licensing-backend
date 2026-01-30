import { expect, vi } from 'vitest'
import * as empModule from './emp-processor.js'

import { config } from '../../../../config.js'
import { REQUEST_QUEUE_STATUS } from '../../constants/request-queue.js'
import Boom from '@hapi/boom'
import * as empClient from './emp-client.js'

vi.mock('../../../../config.js')
vi.mock('./emp-client.js')

describe('EMP Processor', () => {
  let mockServer
  let mockDb

  const mockItem = { _id: 'abc123' }

  vi.useFakeTimers()

  beforeEach(() => {
    mockDb = {
      collection: vi.fn().mockReturnValue({
        find: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([])
        }),
        updateOne: vi.fn().mockResolvedValue({})
      })
    }

    mockServer = {
      app: {},
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      },
      db: mockDb
    }

    config.get.mockReturnValue({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      scope: 'test-scope',
      maxRetries: 3,
      retryDelayMs: 60000,
      tokenUrl: 'https://placeholder.emp.com/oauth2/token'
    })

    vi.clearAllTimers()
  })

  describe('startEmpQueuePolling', () => {
    it('should start polling with the specified interval', () => {
      const intervalMs = 5000
      const setIntervalSpy = vi.spyOn(global, 'setInterval')

      empModule.startEmpQueuePolling(mockServer, intervalMs)
      vi.advanceTimersByTime(intervalMs)

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        intervalMs
      )
      expect(mockServer.app.pollTimer).toBeDefined()
    })
  })

  describe('stopEmpQueuePolling', () => {
    it('should stop polling and clear the timer', () => {
      empModule.startEmpQueuePolling(mockServer, 5000)

      mockServer.logger.info.mockClear()

      empModule.stopEmpQueuePolling(mockServer)

      expect(mockServer.logger.info).not.toHaveBeenCalledWith(
        'Starting exemption queue poll'
      )
    })

    it('should handle stop when no polling is active', () => {
      expect(() => empModule.stopEmpQueuePolling(mockServer)).not.toThrow()
    })
  })

  describe('handleQueueItemSuccess', () => {
    it('should update the item status to SUCCESS and log info', async () => {
      mockServer.db.collection().updateOne.mockReturnValue({})
      const empFeatureId = '1'

      await empModule.handleEmpQueueItemSuccess(
        mockServer,
        mockItem,
        empFeatureId
      )

      expect(mockServer.db.collection().updateOne).toHaveBeenCalledWith(
        mockItem,
        {
          $set: {
            status: REQUEST_QUEUE_STATUS.SUCCESS,
            updatedAt: expect.any(Date),
            empFeatureId
          }
        }
      )
    })
  })

  describe('handleEmpQueueItemFailure', () => {
    it('should increment retries and update status', async () => {
      const item = { ...mockItem, retries: 1 }

      await empModule.handleEmpQueueItemFailure(mockServer, item)

      expect(mockServer.db.collection().updateOne).toHaveBeenCalledWith(
        mockItem,
        {
          $set: {
            status: REQUEST_QUEUE_STATUS.FAILED,
            updatedAt: expect.any(Date)
          },
          $inc: { retries: 1 }
        }
      )
    })

    it('should move to dead letter queue if retries hit the maximum', async () => {
      const insertOne = vi.fn().mockResolvedValue({})
      const deleteOne = vi.fn().mockResolvedValue({})
      mockServer.db.collection.mockImplementation(function (name) {
        if (name === 'exemption-emp-queue') return { deleteOne }
        if (name === 'exemption-emp-queue-failed') return { insertOne }
        throw new Error('Unexpected collection')
      })

      const item = { ...mockItem, retries: 2 }

      await empModule.handleEmpQueueItemFailure(mockServer, item)

      expect(insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockItem,
          retries: 3
        })
      )
      expect(deleteOne).toHaveBeenCalledWith(mockItem)
    })
  })

  describe('processEmpQueue', () => {
    it('should call handleQueueItemSuccess for each queue item', async () => {
      const mockQueueItems = [
        { _id: '1', status: REQUEST_QUEUE_STATUS.PENDING, retries: 0 },
        {
          _id: '2',
          status: REQUEST_QUEUE_STATUS.FAILED,
          retries: 1,
          updatedAt: new Date(Date.now() - 70000)
        }
      ]

      vi.spyOn(empClient, 'sendExemptionToEmp').mockResolvedValue({
        objectId: 'test-feature-id'
      })

      mockServer.db.collection().find.mockReturnValueOnce({
        toArray: vi.fn().mockResolvedValue(mockQueueItems)
      })

      mockServer.db.collection().updateOne.mockResolvedValue({})

      await empModule.processEmpQueue(mockServer)

      expect(mockServer.db.collection().updateOne).toHaveBeenCalledTimes(2)
      expect(mockServer.db.collection().updateOne).toHaveBeenCalledWith(
        { _id: '1' },
        {
          $set: {
            status: REQUEST_QUEUE_STATUS.SUCCESS,
            updatedAt: expect.any(Date),
            empFeatureId: 'test-feature-id'
          }
        }
      )
      expect(mockServer.db.collection().updateOne).toHaveBeenCalledWith(
        { _id: '2' },
        {
          $set: {
            status: REQUEST_QUEUE_STATUS.SUCCESS,
            updatedAt: expect.any(Date),
            empFeatureId: 'test-feature-id'
          }
        }
      )
    })

    it('should handle database errors during processing', async () => {
      mockServer.db.collection.mockImplementation(function () {
        throw new Error('Database error')
      })

      const boomSpy = vi.spyOn(Boom, 'badImplementation')

      await expect(empModule.processEmpQueue(mockServer)).rejects.toThrow()

      expect(boomSpy).toHaveBeenCalledWith(
        'Error during processing EMP queue',
        'Database error'
      )
    })

    it('should call handleQueueItemFailure when processing fails', async () => {
      const mockQueueItems = [
        { _id: '1', status: REQUEST_QUEUE_STATUS.PENDING, retries: 1 }
      ]

      vi.spyOn(empClient, 'sendExemptionToEmp').mockRejectedValue(
        new Error('Processing failed')
      )

      mockServer.db.collection().find.mockReturnValueOnce({
        toArray: vi.fn().mockResolvedValue(mockQueueItems)
      })

      mockServer.db.collection().updateOne.mockResolvedValue({})

      await empModule.processEmpQueue(mockServer)

      expect(mockServer.db.collection().updateOne).toHaveBeenCalledWith(
        { _id: '1' },
        {
          $set: {
            status: REQUEST_QUEUE_STATUS.FAILED,
            updatedAt: expect.any(Date)
          },
          $inc: { retries: 1 }
        }
      )
    })
  })

  describe('addToEmpQueue', () => {
    it('should insert a new item into the EMP queue with correct fields', async () => {
      const insertOne = vi.fn().mockResolvedValue({})
      const findOne = vi.fn().mockResolvedValue(null)
      const mockDb = {
        collection: vi.fn().mockReturnValue({ findOne, insertOne })
      }
      const mockServer = {
        methods: {
          processEmpQueue: vi.fn().mockResolvedValue({})
        },
        logger: {
          error: vi.fn()
        }
      }
      const mockFields = {
        applicationReference: 'APP-001',
        createdAt: new Date('2023-01-01'),
        createdBy: 'user-123',
        updatedAt: new Date('2023-01-01'),
        updatedBy: 'user-123'
      }

      await empModule.addToEmpQueue({
        db: mockDb,
        fields: mockFields,
        server: mockServer
      })

      expect(mockDb.collection).toHaveBeenCalledWith('exemption-emp-queue')
      expect(findOne).toHaveBeenCalledWith({
        applicationReferenceNumber: 'APP-001'
      })
      expect(insertOne).toHaveBeenCalledWith({
        applicationReferenceNumber: 'APP-001',
        status: REQUEST_QUEUE_STATUS.PENDING,
        retries: 0,
        createdAt: new Date('2023-01-01'),
        createdBy: 'user-123',
        updatedAt: new Date('2023-01-01'),
        updatedBy: 'user-123'
      })
    })

    it('should trigger async queue processing after insertion', async () => {
      const processEmpQueue = vi.fn().mockResolvedValue({})
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          findOne: vi.fn().mockResolvedValue(null),
          insertOne: vi.fn().mockResolvedValue({})
        })
      }
      const mockServer = {
        methods: { processEmpQueue },
        logger: { error: vi.fn() }
      }
      const mockFields = {
        applicationReference: 'APP-001',
        createdAt: new Date(),
        createdBy: 'user-123',
        updatedAt: new Date(),
        updatedBy: 'user-123'
      }

      await empModule.addToEmpQueue({
        db: mockDb,
        fields: mockFields,
        server: mockServer
      })

      expect(processEmpQueue).toHaveBeenCalled()
    })

    it('should log error if processEmpQueue fails but not throw', async () => {
      const mockError = new Error('Queue processing failed')
      const processEmpQueue = vi.fn().mockRejectedValue(mockError)
      const mockLogger = { error: vi.fn() }
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          findOne: vi.fn().mockResolvedValue(null),
          insertOne: vi.fn().mockResolvedValue({})
        })
      }
      const mockServer = {
        methods: { processEmpQueue },
        logger: mockLogger
      }
      const mockFields = {
        applicationReference: 'APP-001',
        createdAt: new Date(),
        createdBy: 'user-123',
        updatedAt: new Date(),
        updatedBy: 'user-123'
      }

      await empModule.addToEmpQueue({
        db: mockDb,
        fields: mockFields,
        server: mockServer
      })

      // Wait for the catch to be executed
      await vi.waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to process EMP queue, but exemption submission succeeded'
        )
      })
    })

    it('should throw error if database insertion fails', async () => {
      const dbError = new Error('Database connection failed')
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          findOne: vi.fn().mockResolvedValue(null),
          insertOne: vi.fn().mockRejectedValue(dbError)
        })
      }
      const mockServer = {
        methods: {
          processEmpQueue: vi.fn()
        },
        logger: { error: vi.fn() }
      }
      const mockFields = {
        applicationReference: 'APP-001',
        createdAt: new Date(),
        createdBy: 'user-123',
        updatedAt: new Date(),
        updatedBy: 'user-123'
      }

      await expect(
        empModule.addToEmpQueue({
          db: mockDb,
          fields: mockFields,
          server: mockServer
        })
      ).rejects.toThrow('Database connection failed')
    })

    it('should throw conflict error if exemption already exists in queue', async () => {
      const existingQueueItem = {
        _id: 'existing-id',
        applicationReferenceNumber: 'APP-001',
        status: REQUEST_QUEUE_STATUS.PENDING
      }
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          findOne: vi.fn().mockResolvedValue(existingQueueItem),
          insertOne: vi.fn()
        })
      }
      const mockServer = {
        methods: {
          processEmpQueue: vi.fn()
        },
        logger: { error: vi.fn() }
      }
      const mockFields = {
        applicationReference: 'APP-001',
        createdAt: new Date(),
        createdBy: 'user-123',
        updatedAt: new Date(),
        updatedBy: 'user-123'
      }

      await expect(
        empModule.addToEmpQueue({
          db: mockDb,
          fields: mockFields,
          server: mockServer
        })
      ).rejects.toThrow(
        Boom.conflict('Exemption APP-001 already exists in EMP queue')
      )

      expect(mockDb.collection).toHaveBeenCalledWith('exemption-emp-queue')
      expect(mockDb.collection().findOne).toHaveBeenCalledWith({
        applicationReferenceNumber: 'APP-001'
      })
      expect(mockDb.collection().insertOne).not.toHaveBeenCalled()
    })
  })
})
