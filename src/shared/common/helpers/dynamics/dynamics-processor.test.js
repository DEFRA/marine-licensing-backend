import { expect, vi } from 'vitest'
import { ObjectId } from 'mongodb'
import * as dynamicsModule from './dynamics-processor.js'

import { config } from '../../../../config.js'
import {
  REQUEST_QUEUE_STATUS,
  DYNAMICS_QUEUE_TYPES
} from '../../constants/request-queue.js'
import { getDynamicsAccessToken } from './get-access-token.js'
import { sendToDynamics } from './dynamics-client.js'

vi.mock('../../../../config.js')
vi.mock('./get-access-token.js', () => ({
  getDynamicsAccessToken: vi.fn()
}))
vi.mock('./dynamics-client.js', () => ({
  sendToDynamics: vi.fn()
}))

const EXEMPTION_QUEUE = 'exemption-dynamics-queue'
const EXEMPTION_QUEUE_FAILED = 'exemption-dynamics-queue-failed'
const ML_QUEUE = 'marine-licence-dynamics-queue'
const ML_QUEUE_FAILED = 'marine-licence-dynamics-queue-failed'

const makeCollectionMock = () => ({
  find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
  findOneAndUpdate: vi.fn().mockResolvedValue({ value: null }),
  updateOne: vi.fn().mockResolvedValue({}),
  insertOne: vi.fn().mockResolvedValue({}),
  deleteOne: vi.fn().mockResolvedValue({})
})

describe('Dynamics Processor', () => {
  let mockServer
  let mockDb
  let collections
  const mockGetDynamicsAccessToken = vi.mocked(getDynamicsAccessToken)

  vi.useFakeTimers()

  beforeEach(() => {
    mockGetDynamicsAccessToken.mockReset()
    mockGetDynamicsAccessToken.mockResolvedValue('test_token')
    vi.mocked(sendToDynamics).mockReset()
    vi.mocked(sendToDynamics).mockResolvedValue({})

    collections = {
      [EXEMPTION_QUEUE]: makeCollectionMock(),
      [EXEMPTION_QUEUE_FAILED]: makeCollectionMock(),
      [ML_QUEUE]: makeCollectionMock(),
      [ML_QUEUE_FAILED]: makeCollectionMock()
    }

    mockDb = {
      collection: vi.fn().mockImplementation((name) => {
        if (!collections[name]) {
          collections[name] = makeCollectionMock()
        }
        return collections[name]
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
      projects: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        scope: 'test-scope',
        maxRetries: 3,
        retryDelayMs: 60000,
        claimStaleMs: 1_800_000
      },
      exemptions: {},
      tokenUrl: 'https://placeholder.dynamics.com/oauth2/token'
    })

    vi.clearAllTimers()
  })

  describe('startDynamicsQueuePolling', () => {
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

  describe('stopDynamicsQueuePolling', () => {
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

  describe('handleDynamicsQueueItemSuccess', () => {
    it('should update the exemption queue item status to SUCCESS', async () => {
      const item = { _id: 'abc123', _sourceCollection: EXEMPTION_QUEUE }

      await dynamicsModule.handleDynamicsQueueItemSuccess(mockServer, item)

      expect(collections[EXEMPTION_QUEUE].updateOne).toHaveBeenCalledWith(
        { _id: 'abc123' },
        {
          $set: {
            status: REQUEST_QUEUE_STATUS.SUCCESS,
            updatedAt: expect.any(Date)
          }
        }
      )
    })

    it('should update the marine licence queue item status to SUCCESS', async () => {
      const item = { _id: 'ml123', _sourceCollection: ML_QUEUE }

      await dynamicsModule.handleDynamicsQueueItemSuccess(mockServer, item)

      expect(collections[ML_QUEUE].updateOne).toHaveBeenCalledWith(
        { _id: 'ml123' },
        {
          $set: {
            status: REQUEST_QUEUE_STATUS.SUCCESS,
            updatedAt: expect.any(Date)
          }
        }
      )
    })
  })

  describe('handleDynamicsQueueItemFailure', () => {
    it('should increment retries on an exemption queue item', async () => {
      const item = {
        _id: 'abc123',
        retries: 1,
        _sourceCollection: EXEMPTION_QUEUE
      }

      await dynamicsModule.handleDynamicsQueueItemFailure(mockServer, item)

      expect(collections[EXEMPTION_QUEUE].updateOne).toHaveBeenCalledWith(
        { _id: 'abc123' },
        {
          $set: {
            status: REQUEST_QUEUE_STATUS.FAILED,
            updatedAt: expect.any(Date)
          },
          $inc: { retries: 1 }
        }
      )
    })

    it('should increment retries on a marine licence queue item', async () => {
      const item = {
        _id: 'ml123',
        retries: 1,
        _sourceCollection: ML_QUEUE
      }

      await dynamicsModule.handleDynamicsQueueItemFailure(mockServer, item)

      expect(collections[ML_QUEUE].updateOne).toHaveBeenCalledWith(
        { _id: 'ml123' },
        {
          $set: {
            status: REQUEST_QUEUE_STATUS.FAILED,
            updatedAt: expect.any(Date)
          },
          $inc: { retries: 1 }
        }
      )
    })

    it('should move exemption item to exemption dead letter queue after max retries', async () => {
      const item = {
        _id: 'abc123',
        applicationReferenceNumber: 'EXE/2025/00001',
        retries: 2,
        _sourceCollection: EXEMPTION_QUEUE
      }

      await dynamicsModule.handleDynamicsQueueItemFailure(mockServer, item)

      expect(
        collections[EXEMPTION_QUEUE_FAILED].insertOne
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: 'abc123',
          retries: 3,
          status: REQUEST_QUEUE_STATUS.FAILED
        })
      )
      expect(
        collections[EXEMPTION_QUEUE_FAILED].insertOne.mock.calls[0][0]
      ).not.toHaveProperty('_sourceCollection')
      expect(collections[EXEMPTION_QUEUE].deleteOne).toHaveBeenCalledWith({
        _id: 'abc123'
      })
    })

    it('should move marine licence item to marine licence dead letter queue after max retries', async () => {
      const item = {
        _id: 'ml123',
        applicationReferenceNumber: 'MLA/2025/00001',
        retries: 2,
        _sourceCollection: ML_QUEUE
      }

      await dynamicsModule.handleDynamicsQueueItemFailure(mockServer, item)

      expect(collections[ML_QUEUE_FAILED].insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: 'ml123',
          retries: 3,
          status: REQUEST_QUEUE_STATUS.FAILED
        })
      )
      expect(
        collections[ML_QUEUE_FAILED].insertOne.mock.calls[0][0]
      ).not.toHaveProperty('_sourceCollection')
      expect(collections[ML_QUEUE].deleteOne).toHaveBeenCalledWith({
        _id: 'ml123'
      })
    })
  })

  describe('processDynamicsQueue (mock DB errors)', () => {
    it('should log errors and skip processing if claim fails on both collections', async () => {
      collections[EXEMPTION_QUEUE].findOneAndUpdate.mockRejectedValue(
        new Error('Database error')
      )
      collections[ML_QUEUE].findOneAndUpdate.mockRejectedValue(
        new Error('Database error')
      )

      await dynamicsModule.processDynamicsQueue(mockServer)

      expect(mockServer.logger.error).toHaveBeenCalledTimes(2)
      expect(vi.mocked(sendToDynamics)).not.toHaveBeenCalled()
    })

    it('should still process the successful collection if one claim fails', async () => {
      const exemptionItem = {
        _id: new ObjectId(),
        status: REQUEST_QUEUE_STATUS.IN_PROGRESS,
        retries: 0,
        type: DYNAMICS_QUEUE_TYPES.EXEMPTION,
        applicationReferenceNumber: 'EXE/2025/00999',
        action: 'submit'
      }

      collections[EXEMPTION_QUEUE].findOneAndUpdate
        .mockResolvedValueOnce({
          value: exemptionItem,
          ok: 1
        })
        .mockResolvedValue({ value: null, ok: 1 })
      collections[ML_QUEUE].findOneAndUpdate.mockRejectedValue(
        new Error('ML collection unavailable')
      )

      await dynamicsModule.processDynamicsQueue(mockServer)

      expect(mockServer.logger.error).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to claim dynamics queue item from ${ML_QUEUE}`
      )
      expect(collections[EXEMPTION_QUEUE].updateOne).toHaveBeenCalledWith(
        { _id: exemptionItem._id },
        {
          $set: {
            status: REQUEST_QUEUE_STATUS.SUCCESS,
            updatedAt: expect.any(Date)
          }
        }
      )
    })
  })

  describe('addToDynamicsQueue', () => {
    const makeRequest = (server) => ({
      payload: {
        createdAt: new Date(),
        createdBy: 'user1',
        updatedAt: new Date(),
        updatedBy: 'user1'
      },
      db: server.db,
      server
    })

    it('should insert into the exemption queue by default', async () => {
      mockServer.methods = {
        processDynamicsQueue: vi.fn().mockResolvedValue({})
      }

      await dynamicsModule.addToDynamicsQueue({
        request: makeRequest(mockServer),
        applicationReference: 'EXE/2025/00001',
        action: 'submit'
      })

      expect(collections[EXEMPTION_QUEUE].insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DYNAMICS_QUEUE_TYPES.EXEMPTION,
          action: 'submit',
          applicationReferenceNumber: 'EXE/2025/00001',
          status: REQUEST_QUEUE_STATUS.PENDING,
          retries: 0
        })
      )
    })

    it('should insert into the marine licence queue when type is marineLicence', async () => {
      mockServer.methods = {
        processDynamicsQueue: vi.fn().mockResolvedValue({})
      }

      await dynamicsModule.addToDynamicsQueue({
        request: makeRequest(mockServer),
        applicationReference: 'MLA/2025/00001',
        action: 'submit',
        type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE
      })

      expect(collections[ML_QUEUE].insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE,
          action: 'submit',
          applicationReferenceNumber: 'MLA/2025/00001',
          status: REQUEST_QUEUE_STATUS.PENDING,
          retries: 0
        })
      )
      expect(collections[EXEMPTION_QUEUE].insertOne).not.toHaveBeenCalled()
    })
  })
})
