import { expect, vi } from 'vitest'
import * as empModule from './emp-processor.js'

import { config } from '../../../config.js'
import { REQUEST_QUEUE_STATUS } from '../../constants/request-queue.js'
import Boom from '@hapi/boom'

vi.mock('../../../config.js')
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

      await empModule.handleEmpQueueItemSuccess(mockServer, mockItem)

      expect(mockServer.db.collection().updateOne).toHaveBeenCalledWith(
        mockItem,
        {
          $set: {
            status: REQUEST_QUEUE_STATUS.SUCCESS,
            updatedAt: expect.any(Date),
            userName: null
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
          userName: null,
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
            userName: null
          }
        }
      )
      expect(mockServer.db.collection().updateOne).toHaveBeenCalledWith(
        { _id: '2' },
        {
          $set: {
            status: REQUEST_QUEUE_STATUS.SUCCESS,
            updatedAt: expect.any(Date),
            userName: null
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

      mockServer.db.collection().find.mockReturnValueOnce({
        toArray: vi.fn().mockResolvedValue(mockQueueItems)
      })

      mockServer.db
        .collection()
        .updateOne.mockRejectedValueOnce('Processing failed')

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
})
