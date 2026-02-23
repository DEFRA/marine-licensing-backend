import { expect, vi } from 'vitest'
import * as dynamicsModule from './dynamics-processor.js'

import { config } from '../../../../config.js'
import { REQUEST_QUEUE_STATUS } from '../../constants/request-queue.js'
import Boom from '@hapi/boom'
import { getDynamicsAccessToken } from './get-access-token.js'
import { sendToDynamics } from './dynamics-client.js'

vi.mock('../../../../config.js')
vi.mock('./get-access-token.js')
vi.mock('./dynamics-client.js')

describe('Dynamics Processor', () => {
  let mockServer
  let mockDb
  const mockGetDynamicsAccessToken = vi.mocked(getDynamicsAccessToken)

  const mockItem = { _id: 'abc123' }

  vi.useFakeTimers()

  beforeEach(() => {
    mockGetDynamicsAccessToken.mockReturnValue('test_token')

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
      exemptions: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        scope: 'test-scope',
        maxRetries: 3,
        retryDelayMs: 60000,
        tokenUrl: 'https://placeholder.dynamics.com/oauth2/token'
      }
    })

    vi.clearAllTimers()
  })

  describe('startExemptionsQueuePolling', () => {
    it('should start polling with the specified interval', () => {
      const intervalMs = 5000
      const setIntervalSpy = vi.spyOn(global, 'setInterval')

      dynamicsModule.startDynamicsQueuePolling(mockServer, intervalMs)
      vi.advanceTimersByTime(intervalMs)

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        intervalMs
      )
      expect(mockServer.app.pollTimer).toBeDefined()
    })
  })

  describe('stopExemptionsQueuePolling', () => {
    it('should stop polling and clear the timer', () => {
      dynamicsModule.startDynamicsQueuePolling(mockServer, 5000)

      mockServer.logger.info.mockClear()

      dynamicsModule.stopDynamicsQueuePolling(mockServer)

      expect(mockServer.logger.info).not.toHaveBeenCalledWith(
        'Starting exemption queue poll'
      )
    })

    it('should handle stop when no polling is active', () => {
      expect(() =>
        dynamicsModule.stopDynamicsQueuePolling(mockServer)
      ).not.toThrow()
    })
  })

  describe('handleQueueItemSuccess', () => {
    it('should update the item status to SUCCESS and log info', async () => {
      mockServer.db.collection().updateOne.mockReturnValue({})

      await dynamicsModule.handleDynamicsQueueItemSuccess(mockServer, mockItem)

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

      await dynamicsModule.handleDynamicsQueueItemFailure(mockServer, item)

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
        if (name === 'exemption-dynamics-queue') return { deleteOne }
        if (name === 'exemption-dynamics-queue-failed') return { insertOne }
        throw new Error('Unexpected collection')
      })

      const item = { ...mockItem, retries: 2 }

      await dynamicsModule.handleDynamicsQueueItemFailure(mockServer, item)

      expect(insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockItem,
          retries: 3
        })
      )
      expect(deleteOne).toHaveBeenCalledWith(mockItem)
    })
  })

  describe('processDynamicsQueue', () => {
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

      await dynamicsModule.processDynamicsQueue(mockServer)

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
      mockServer.db.collection.mockImplementation(function () {
        throw new Error('Database error')
      })

      const boomSpy = vi.spyOn(Boom, 'badImplementation')

      await expect(
        dynamicsModule.processDynamicsQueue(mockServer)
      ).rejects.toThrow()

      expect(boomSpy).toHaveBeenCalledWith(
        'Error during processing dynamics queue',
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

      // Mock sendToDynamics to fail for this test
      vi.mocked(sendToDynamics).mockRejectedValueOnce(
        new Error('Processing failed')
      )

      await dynamicsModule.processDynamicsQueue(mockServer)

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
        toArray: vi.fn().mockResolvedValue(mockQueueItems)
      })

      mockServer.db.collection().updateOne.mockResolvedValue({})

      await dynamicsModule.processDynamicsQueue(mockServer)

      expect(mockGetDynamicsAccessToken).toHaveBeenCalled()
    })
  })
})
