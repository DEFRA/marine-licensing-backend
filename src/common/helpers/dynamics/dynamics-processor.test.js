import { expect, jest } from '@jest/globals'
import * as dynamicsModule from './dynamics-processor.js'
import { getDynamicsAccessToken } from './dynamics-client.js'

import { config } from '../../../config.js'
import { REQUEST_QUEUE_STATUS } from '../../constants/request-queue.js'
import Boom from '@hapi/boom'

jest.mock('../../../config.js')
jest.mock('./dynamics-client.js')

describe('Dynamics Processor', () => {
  let mockServer
  let mockDb
  const mockGetDynamicsAccessToken = jest.mocked(getDynamicsAccessToken)

  const mockItem = { _id: 'abc123' }

  jest.useFakeTimers()

  beforeEach(() => {
    mockGetDynamicsAccessToken.mockReturnValue('test_token')

    mockDb = {
      collection: jest.fn().mockReturnValue({
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        }),
        updateOne: jest.fn().mockResolvedValue({})
      })
    }

    mockServer = {
      app: {},
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      },
      db: mockDb
    }

    config.get.mockReturnValue({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      scope: 'test-scope',
      maxRetries: 3,
      retryDelayMs: 60000,
      tokenUrl: 'https://placeholder.dynamics.com/oauth2/token'
    })

    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  describe('startExemptionsQueuePolling', () => {
    it('should start polling with the specified interval', () => {
      const intervalMs = 5000

      dynamicsModule.startExemptionsQueuePolling(mockServer, intervalMs)

      jest.advanceTimersByTime(10000)
      jest.advanceTimersByTime(intervalMs)

      expect(mockServer.logger.info).toHaveBeenCalledWith(
        'Starting exemption queue poll'
      )
    })
  })

  describe('stopExemptionsQueuePolling', () => {
    it('should stop polling and clear the timer', () => {
      dynamicsModule.startExemptionsQueuePolling(mockServer, 5000)

      mockServer.logger.info.mockClear()

      dynamicsModule.stopExemptionsQueuePolling(mockServer)

      expect(mockServer.logger.info).not.toHaveBeenCalledWith(
        'Starting exemption queue poll'
      )
    })

    it('should handle stop when no polling is active', () => {
      expect(() =>
        dynamicsModule.stopExemptionsQueuePolling(mockServer)
      ).not.toThrow()
    })
  })

  describe('handleQueueItemSuccess', () => {
    it('should update the item status to SUCCESS and log info', async () => {
      mockServer.db.collection().updateOne.mockReturnValue({})

      await dynamicsModule.handleQueueItemSuccess(mockServer, mockItem)

      expect(mockServer.db.collection().updateOne).toHaveBeenCalledWith(
        mockItem,
        {
          $set: {
            status: REQUEST_QUEUE_STATUS.SUCCESS,
            updatedAt: expect.any(Date)
          }
        }
      )
    })
  })

  describe('handleQueueItemFailure', () => {
    it('should increment retries and update status', async () => {
      const item = { ...mockItem, retries: 1 }

      await dynamicsModule.handleQueueItemFailure(mockServer, item)

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
      const insertOne = jest.fn().mockResolvedValue({})
      const deleteOne = jest.fn().mockResolvedValue({})
      mockServer.db.collection.mockImplementation((name) => {
        if (name === 'exemption-dynamics-queue') return { deleteOne }
        if (name === 'exemption-dynamics-queue-failed') return { insertOne }
        throw new Error('Unexpected collection')
      })

      const item = { ...mockItem, retries: 2 }

      await dynamicsModule.handleQueueItemFailure(mockServer, item)

      expect(insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockItem,
          retries: 3
        })
      )
      expect(deleteOne).toHaveBeenCalledWith(mockItem)
    })
  })

  describe('processExemptionsQueue', () => {
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
        toArray: jest.fn().mockResolvedValue(mockQueueItems)
      })

      mockServer.db.collection().updateOne.mockResolvedValue({})

      await dynamicsModule.processExemptionsQueue(mockServer)

      expect(mockServer.db.collection().updateOne).toHaveBeenCalledTimes(2)
      expect(mockServer.db.collection().updateOne).toHaveBeenCalledWith(
        { _id: '1' },
        {
          $set: {
            status: REQUEST_QUEUE_STATUS.SUCCESS,
            updatedAt: expect.any(Date)
          }
        }
      )
      expect(mockServer.db.collection().updateOne).toHaveBeenCalledWith(
        { _id: '2' },
        {
          $set: {
            status: REQUEST_QUEUE_STATUS.SUCCESS,
            updatedAt: expect.any(Date)
          }
        }
      )
    })

    it('should handle database errors during processing', async () => {
      mockServer.db.collection.mockImplementation(() => {
        throw new Error('Database error')
      })

      const boomSpy = jest.spyOn(Boom, 'badImplementation')

      await expect(
        dynamicsModule.processExemptionsQueue(mockServer)
      ).rejects.toThrow()

      expect(boomSpy).toHaveBeenCalledWith(
        'Error during processing',
        'Database error'
      )
    })

    it('should call handleQueueItemFailure when processing fails', async () => {
      const mockQueueItems = [
        { _id: '1', status: REQUEST_QUEUE_STATUS.PENDING, retries: 1 }
      ]

      mockServer.db.collection().find.mockReturnValueOnce({
        toArray: jest.fn().mockResolvedValue(mockQueueItems)
      })

      mockServer.db
        .collection()
        .updateOne.mockRejectedValueOnce('Processing failed')

      await dynamicsModule.processExemptionsQueue(mockServer)

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

    it('should get access token before processing queue items', async () => {
      const mockQueueItems = [
        { _id: '1', status: REQUEST_QUEUE_STATUS.PENDING, retries: 0 }
      ]
      mockServer.db.collection().find.mockReturnValueOnce({
        toArray: jest.fn().mockResolvedValue(mockQueueItems)
      })

      mockServer.db.collection().updateOne.mockResolvedValue({})

      await dynamicsModule.processExemptionsQueue(mockServer)

      expect(mockGetDynamicsAccessToken).toHaveBeenCalled()
    })
  })
})
