import { jest } from '@jest/globals'
import {
  startExemptionsQueuePolling,
  stopExemptionsQueuePolling,
  processExemptionsQueue
} from './dynamics.js'

import { config } from '../../config.js'

jest.mock('../../config.js')

describe('Dynamics Helper', () => {
  let mockServer

  jest.useFakeTimers()

  beforeEach(() => {
    mockServer = {
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      },
      db: {
        collection: jest.fn().mockReturnValue({
          find: jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue([])
          }),
          updateOne: jest.fn().mockResolvedValue({})
        })
      }
    }

    config.get.mockReturnValue({ maxRetries: 3, retryDelayMs: 60000 })

    jest.clearAllTimers()
  })

  afterEach(() => {
    stopExemptionsQueuePolling(mockServer)
  })

  describe('startExemptionsQueuePolling', () => {
    it('should start polling with the specified interval', () => {
      const intervalMs = 5000

      startExemptionsQueuePolling(mockServer, intervalMs)

      jest.advanceTimersByTime(10000)
      jest.advanceTimersByTime(intervalMs)

      expect(mockServer.logger.info).toHaveBeenCalledWith(
        'Starting exemption queue poll'
      )
    })
  })

  describe('stopExemptionsQueuePolling', () => {
    it('should stop polling and clear the timer', () => {
      startExemptionsQueuePolling(mockServer, 5000)

      mockServer.logger.info.mockClear()

      stopExemptionsQueuePolling(mockServer)

      expect(mockServer.logger.info).not.toHaveBeenCalledWith(
        'Starting exemption queue poll'
      )
    })

    it('should handle stop when no polling is active', () => {
      expect(() => stopExemptionsQueuePolling(mockServer)).not.toThrow()
    })
  })

  describe('processExemptionsQueue', () => {
    it('should process queue items and log them', async () => {
      const mockQueueItems = [
        { _id: '1', status: 'pending', retries: 0 },
        {
          _id: '2',
          status: 'failed',
          retries: 1,
          updatedAt: new Date(Date.now() - 70000)
        }
      ]

      mockServer.db.collection.mockReturnValue({
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue(mockQueueItems)
        })
      })

      await expect(processExemptionsQueue(mockServer)).resolves.toBeUndefined()

      expect(mockServer.logger.info).toHaveBeenCalledWith(mockQueueItems[0])
      expect(mockServer.logger.info).toHaveBeenCalledWith(mockQueueItems[1])
    })

    it('should handle database errors during processing', async () => {
      mockServer.db.collection.mockImplementation(() => {
        throw new Error('Database error')
      })

      await expect(processExemptionsQueue(mockServer)).rejects.toThrow(
        'Error during processing'
      )
    })
  })
})
