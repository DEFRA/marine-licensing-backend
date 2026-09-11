import { expect, vi } from 'vitest'
import { ObjectId } from 'mongodb'
import * as empModule from './emp-processor.js'
import { EMP_QUEUE_MAX_ITEMS_PER_PROCESS_RUN } from './emp-processor.js'

import { config } from '../../../../config.js'
import {
  REQUEST_QUEUE_STATUS,
  EMP_REQUEST_ACTIONS
} from '../../constants/request-queue.js'
import Boom from '@hapi/boom'
import * as empClient from './emp-client.js'

vi.mock('../../../../config.js')
vi.mock('./emp-client.js')

const EMP_QUEUE = 'exemption-emp-queue'
const EMP_QUEUE_FAILED = 'exemption-emp-queue-failed'

// The retry delay a FAILED row must clear before it is claimable again.
// Mirrors the hardcoded QUEUE_DELAY_MS in emp-processor.js.
const RETRY_DELAY_MS = 2_000

describe('EMP Processor', () => {
  let mockServer

  const queueDocBase = {
    retries: 0,
    createdAt: new Date(),
    createdBy: 'user',
    updatedAt: new Date(),
    updatedBy: 'user'
  }

  beforeAll(() => {
    if (!globalThis.mockMongo) {
      throw new Error(
        'vitest setup must provide globalThis.mockMongo (see .vite/setup-files.js)'
      )
    }
  })

  beforeEach(async () => {
    vi.useRealTimers()

    const db = globalThis.mockMongo
    await Promise.all([
      db.collection(EMP_QUEUE).deleteMany({}),
      db.collection(EMP_QUEUE_FAILED).deleteMany({})
    ])

    mockServer = {
      app: {},
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      },
      db
    }

    config.get.mockReturnValue({
      apiUrl: 'https://placeholder.emp.com',
      apiKey: 'test-api-key',
      isEmpEnabled: true,
      maxRetries: 3,
      retryDelayMs: 60000,
      claimStaleMs: 1_800_000
    })

    vi.mocked(empClient.sendExemptionToEmp).mockReset()
    vi.mocked(empClient.withdrawExemptionFromEmp).mockReset()
    vi.mocked(empClient.updateExemptionStatusInEmp).mockReset()
  })

  describe('startEmpQueuePolling', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should start polling with the specified interval', () => {
      const intervalMs = 5000
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

      empModule.startEmpQueuePolling(mockServer, intervalMs)
      vi.advanceTimersByTime(intervalMs)

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        intervalMs
      )
      expect(mockServer.app.pollTimer).toBeDefined()

      setIntervalSpy.mockRestore()
      empModule.stopEmpQueuePolling(mockServer)
    })
  })

  describe('stopEmpQueuePolling', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

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

  describe('handleEmpQueueItemSuccess', () => {
    it('updates the queue item to SUCCESS with the returned feature ids', async () => {
      const db = globalThis.mockMongo
      const _id = new ObjectId()
      await db.collection(EMP_QUEUE).insertOne({
        _id,
        ...queueDocBase,
        applicationReferenceNumber: 'EXE/SUCCESS/1',
        status: REQUEST_QUEUE_STATUS.IN_PROGRESS
      })

      await empModule.handleEmpQueueItemSuccess(
        mockServer,
        { _id, applicationReferenceNumber: 'EXE/SUCCESS/1' },
        ['feature-1', 'feature-2']
      )

      const doc = await db.collection(EMP_QUEUE).findOne({ _id })
      expect(doc.status).toBe(REQUEST_QUEUE_STATUS.SUCCESS)
      expect(doc.empFeatureIds).toEqual(['feature-1', 'feature-2'])
    })
  })

  describe('handleEmpQueueItemFailure', () => {
    it('increments retries using the count on the document it is given', async () => {
      const db = globalThis.mockMongo
      const _id = new ObjectId()
      await db.collection(EMP_QUEUE).insertOne({
        _id,
        ...queueDocBase,
        applicationReferenceNumber: 'EXE/FAIL/1',
        status: REQUEST_QUEUE_STATUS.IN_PROGRESS,
        retries: 1
      })

      await empModule.handleEmpQueueItemFailure(mockServer, {
        _id,
        applicationReferenceNumber: 'EXE/FAIL/1',
        retries: 1
      })

      const doc = await db.collection(EMP_QUEUE).findOne({ _id })
      expect(doc.status).toBe(REQUEST_QUEUE_STATUS.FAILED)
      expect(doc.retries).toBe(2)
    })

    it('moves the item to the dead letter queue once retries hit the maximum', async () => {
      const db = globalThis.mockMongo
      const _id = new ObjectId()
      await db.collection(EMP_QUEUE).insertOne({
        _id,
        ...queueDocBase,
        applicationReferenceNumber: 'EXE/DL/1',
        status: REQUEST_QUEUE_STATUS.IN_PROGRESS,
        retries: 2
      })

      await empModule.handleEmpQueueItemFailure(mockServer, {
        _id,
        applicationReferenceNumber: 'EXE/DL/1',
        retries: 2
      })

      const main = await db.collection(EMP_QUEUE).findOne({ _id })
      expect(main).toBeNull()

      const dead = await db.collection(EMP_QUEUE_FAILED).findOne({ _id })
      expect(dead).toMatchObject({
        retries: 3,
        status: REQUEST_QUEUE_STATUS.FAILED
      })
    })

    it('moves the item to the dead letter queue immediately on a hard fail', async () => {
      const db = globalThis.mockMongo
      const _id = new ObjectId()
      await db.collection(EMP_QUEUE).insertOne({
        _id,
        ...queueDocBase,
        applicationReferenceNumber: 'EXE/HARDFAIL/1',
        status: REQUEST_QUEUE_STATUS.IN_PROGRESS,
        retries: 0
      })

      await empModule.handleEmpQueueItemFailure(
        mockServer,
        { _id, applicationReferenceNumber: 'EXE/HARDFAIL/1', retries: 0 },
        { hardFail: true }
      )

      const main = await db.collection(EMP_QUEUE).findOne({ _id })
      expect(main).toBeNull()

      const dead = await db.collection(EMP_QUEUE_FAILED).findOne({ _id })
      expect(dead).toMatchObject({
        retries: 0,
        status: REQUEST_QUEUE_STATUS.FAILED
      })
    })
  })

  describe('processEmpQueue', () => {
    it('does not let a second poll claim a row the first poll has already claimed', async () => {
      const db = globalThis.mockMongo
      await db.collection(EMP_QUEUE).insertOne({
        ...queueDocBase,
        applicationReferenceNumber: 'EXE/CLAIM/1',
        status: REQUEST_QUEUE_STATUS.PENDING
      })

      let resolvePush
      const pushHung = new Promise((resolve) => {
        resolvePush = resolve
      })
      vi.mocked(empClient.sendExemptionToEmp).mockReturnValue(pushHung)

      // Simulates the first of two concurrently-polling instances: it claims
      // the row and is then held mid-push.
      const firstRun = empModule.processEmpQueue(mockServer)

      await vi.waitFor(() =>
        expect(vi.mocked(empClient.sendExemptionToEmp)).toHaveBeenCalledTimes(1)
      )

      const claimed = await db.collection(EMP_QUEUE).findOne({
        applicationReferenceNumber: 'EXE/CLAIM/1'
      })
      expect(claimed.status).toBe(REQUEST_QUEUE_STATUS.IN_PROGRESS)

      // A second instance polling while the first is still mid-push must
      // find nothing to claim.
      await empModule.processEmpQueue(mockServer)

      expect(vi.mocked(empClient.sendExemptionToEmp)).toHaveBeenCalledTimes(1)

      resolvePush({ objectIds: ['emp-1'] })
      await firstRun

      const final = await db.collection(EMP_QUEUE).findOne({
        applicationReferenceNumber: 'EXE/CLAIM/1'
      })
      expect(final.status).toBe(REQUEST_QUEUE_STATUS.SUCCESS)
    })

    it('reclaims a stale in_progress row once past claimStaleMs', async () => {
      const db = globalThis.mockMongo
      const staleAt = new Date(Date.now() - 2 * 60 * 60 * 1000)
      await db.collection(EMP_QUEUE).insertOne({
        ...queueDocBase,
        applicationReferenceNumber: 'EXE/STALE/1',
        status: REQUEST_QUEUE_STATUS.IN_PROGRESS,
        updatedAt: staleAt
      })
      vi.mocked(empClient.sendExemptionToEmp).mockResolvedValue({
        objectIds: ['emp-1']
      })

      await empModule.processEmpQueue(mockServer)

      const doc = await db.collection(EMP_QUEUE).findOne({
        applicationReferenceNumber: 'EXE/STALE/1'
      })
      expect(doc.status).toBe(REQUEST_QUEUE_STATUS.SUCCESS)
    })

    it('does not reclaim an in_progress row while it is still fresh', async () => {
      const db = globalThis.mockMongo
      await db.collection(EMP_QUEUE).insertOne({
        ...queueDocBase,
        applicationReferenceNumber: 'EXE/FRESH/1',
        status: REQUEST_QUEUE_STATUS.IN_PROGRESS,
        updatedAt: new Date()
      })

      await empModule.processEmpQueue(mockServer)

      const doc = await db.collection(EMP_QUEUE).findOne({
        applicationReferenceNumber: 'EXE/FRESH/1'
      })
      expect(doc.status).toBe(REQUEST_QUEUE_STATUS.IN_PROGRESS)
      expect(empClient.sendExemptionToEmp).not.toHaveBeenCalled()
    })

    it('reclaims a failed row once the retry delay has passed', async () => {
      const db = globalThis.mockMongo
      await db.collection(EMP_QUEUE).insertOne({
        ...queueDocBase,
        applicationReferenceNumber: 'EXE/RETRY/1',
        status: REQUEST_QUEUE_STATUS.FAILED,
        updatedAt: new Date(Date.now() - (RETRY_DELAY_MS + 1000))
      })
      vi.mocked(empClient.sendExemptionToEmp).mockResolvedValue({
        objectIds: ['emp-1']
      })

      await empModule.processEmpQueue(mockServer)

      const doc = await db.collection(EMP_QUEUE).findOne({
        applicationReferenceNumber: 'EXE/RETRY/1'
      })
      expect(doc.status).toBe(REQUEST_QUEUE_STATUS.SUCCESS)
    })

    it('does not reclaim a failed row before the retry delay has passed', async () => {
      const db = globalThis.mockMongo
      await db.collection(EMP_QUEUE).insertOne({
        ...queueDocBase,
        applicationReferenceNumber: 'EXE/RETRY/2',
        status: REQUEST_QUEUE_STATUS.FAILED,
        updatedAt: new Date()
      })

      await empModule.processEmpQueue(mockServer)

      const doc = await db.collection(EMP_QUEUE).findOne({
        applicationReferenceNumber: 'EXE/RETRY/2'
      })
      expect(doc.status).toBe(REQUEST_QUEUE_STATUS.FAILED)
      expect(empClient.sendExemptionToEmp).not.toHaveBeenCalled()
    })

    it('carries the retry count on the claimed document into the dead-letter decision', async () => {
      // maxRetries is 3 (see beforeEach); a row already on its second retry
      // must be dead-lettered on this failure, not incremented again. Getting
      // this right depends on the claim handing handleEmpQueueItemFailure the
      // row's real retries count rather than a stale or missing one.
      const db = globalThis.mockMongo
      await db.collection(EMP_QUEUE).insertOne({
        ...queueDocBase,
        applicationReferenceNumber: 'EXE/RETRYCOUNT/1',
        status: REQUEST_QUEUE_STATUS.FAILED,
        retries: 2,
        updatedAt: new Date(Date.now() - (RETRY_DELAY_MS + 1000))
      })
      vi.mocked(empClient.sendExemptionToEmp).mockRejectedValue(
        new Error('Push failed')
      )

      await empModule.processEmpQueue(mockServer)

      const main = await db.collection(EMP_QUEUE).findOne({
        applicationReferenceNumber: 'EXE/RETRYCOUNT/1'
      })
      expect(main).toBeNull()

      const dead = await db.collection(EMP_QUEUE_FAILED).findOne({
        applicationReferenceNumber: 'EXE/RETRYCOUNT/1'
      })
      expect(dead).toMatchObject({
        retries: 3,
        status: REQUEST_QUEUE_STATUS.FAILED
      })
    })

    it('stops at the per-run bound rather than draining an arbitrarily long queue', async () => {
      const db = globalThis.mockMongo
      const extra = 3
      const total = EMP_QUEUE_MAX_ITEMS_PER_PROCESS_RUN + extra
      const docs = Array.from({ length: total }, (_, i) => ({
        ...queueDocBase,
        applicationReferenceNumber: `EXE/CAP/${String(i).padStart(5, '0')}`,
        status: REQUEST_QUEUE_STATUS.PENDING
      }))
      await db.collection(EMP_QUEUE).insertMany(docs)
      vi.mocked(empClient.sendExemptionToEmp).mockResolvedValue({
        objectIds: ['emp-1']
      })

      await empModule.processEmpQueue(mockServer)

      expect(vi.mocked(empClient.sendExemptionToEmp)).toHaveBeenCalledTimes(
        EMP_QUEUE_MAX_ITEMS_PER_PROCESS_RUN
      )
      const pending = await db
        .collection(EMP_QUEUE)
        .countDocuments({ status: REQUEST_QUEUE_STATUS.PENDING })
      expect(pending).toBe(extra)
      const success = await db
        .collection(EMP_QUEUE)
        .countDocuments({ status: REQUEST_QUEUE_STATUS.SUCCESS })
      expect(success).toBe(EMP_QUEUE_MAX_ITEMS_PER_PROCESS_RUN)
    })

    it('routes an update-status item to the status push', async () => {
      const db = globalThis.mockMongo
      await db.collection(EMP_QUEUE).insertOne({
        ...queueDocBase,
        applicationReferenceNumber: 'EXE/ROUTE/STATUS',
        action: EMP_REQUEST_ACTIONS.UPDATE_STATUS,
        status: REQUEST_QUEUE_STATUS.PENDING
      })
      vi.mocked(empClient.updateExemptionStatusInEmp).mockResolvedValue({
        objectIds: ['emp-1']
      })

      await empModule.processEmpQueue(mockServer)

      expect(empClient.updateExemptionStatusInEmp).toHaveBeenCalledWith(
        mockServer,
        expect.objectContaining({
          applicationReferenceNumber: 'EXE/ROUTE/STATUS',
          action: EMP_REQUEST_ACTIONS.UPDATE_STATUS
        })
      )
      expect(empClient.sendExemptionToEmp).not.toHaveBeenCalled()
      expect(empClient.withdrawExemptionFromEmp).not.toHaveBeenCalled()
    })

    it('routes a withdraw item to the withdrawal push', async () => {
      const db = globalThis.mockMongo
      await db.collection(EMP_QUEUE).insertOne({
        ...queueDocBase,
        applicationReferenceNumber: 'EXE/ROUTE/WITHDRAW',
        action: EMP_REQUEST_ACTIONS.WITHDRAW,
        status: REQUEST_QUEUE_STATUS.PENDING
      })
      vi.mocked(empClient.withdrawExemptionFromEmp).mockResolvedValue({
        objectIds: ['emp-1']
      })

      await empModule.processEmpQueue(mockServer)

      expect(empClient.withdrawExemptionFromEmp).toHaveBeenCalledWith(
        mockServer,
        expect.objectContaining({
          applicationReferenceNumber: 'EXE/ROUTE/WITHDRAW',
          action: EMP_REQUEST_ACTIONS.WITHDRAW
        })
      )
      expect(empClient.sendExemptionToEmp).not.toHaveBeenCalled()
      expect(empClient.updateExemptionStatusInEmp).not.toHaveBeenCalled()
    })

    it('still treats a row with no action as an add', async () => {
      const db = globalThis.mockMongo
      await db.collection(EMP_QUEUE).insertOne({
        ...queueDocBase,
        applicationReferenceNumber: 'EXE/ROUTE/NOACTION',
        status: REQUEST_QUEUE_STATUS.PENDING
      })
      vi.mocked(empClient.sendExemptionToEmp).mockResolvedValue({
        objectIds: ['emp-1']
      })

      await empModule.processEmpQueue(mockServer)

      expect(empClient.sendExemptionToEmp).toHaveBeenCalledWith(
        mockServer,
        expect.objectContaining({
          applicationReferenceNumber: 'EXE/ROUTE/NOACTION'
        })
      )
      expect(empClient.updateExemptionStatusInEmp).not.toHaveBeenCalled()
      expect(empClient.withdrawExemptionFromEmp).not.toHaveBeenCalled()
    })

    it('should not get a claim or push when the queue is empty', async () => {
      await empModule.processEmpQueue(mockServer)

      expect(empClient.sendExemptionToEmp).not.toHaveBeenCalled()
    })

    it('logs and skips processing when a claim attempt errors', async () => {
      const db = globalThis.mockMongo
      await db.collection(EMP_QUEUE).insertOne({
        ...queueDocBase,
        applicationReferenceNumber: 'EXE/CLAIMERR/1',
        status: REQUEST_QUEUE_STATUS.PENDING
      })

      const realCollection = db.collection(EMP_QUEUE)
      mockServer.db = {
        collection: (name) => {
          if (name !== EMP_QUEUE) {
            return db.collection(name)
          }
          return new Proxy(realCollection, {
            get(target, prop) {
              if (prop === 'findOneAndUpdate') {
                return () => Promise.reject(new Error('Database error'))
              }
              return Reflect.get(target, prop)
            }
          })
        }
      }

      await expect(empModule.processEmpQueue(mockServer)).resolves.not.toThrow()

      expect(mockServer.logger.error).toHaveBeenCalledWith(
        expect.anything(),
        'Failed to claim EMP queue item'
      )
      expect(empClient.sendExemptionToEmp).not.toHaveBeenCalled()
    })

    it('wraps an unexpected error outside the claim path in a Boom error', async () => {
      config.get.mockImplementationOnce(() => {
        throw new Error('Config error')
      })

      const boomSpy = vi.spyOn(Boom, 'badImplementation')

      await expect(empModule.processEmpQueue(mockServer)).rejects.toThrow()

      expect(boomSpy).toHaveBeenCalledWith(
        'Error during processing EMP queue',
        'Config error'
      )
    })
  })

  describe('addToEmpQueue', () => {
    const makeRequest = (server) => ({
      payload: {
        createdAt: new Date('2023-01-01'),
        createdBy: 'user-123',
        updatedAt: new Date('2023-01-01'),
        updatedBy: 'user-123'
      },
      db: server.db,
      server
    })

    it('should insert a new item into the EMP queue with correct fields', async () => {
      const db = globalThis.mockMongo
      mockServer.methods = {
        processEmpQueue: vi.fn().mockResolvedValue({})
      }

      await empModule.addToEmpQueue({
        request: makeRequest(mockServer),
        applicationReference: 'APP-001',
        action: EMP_REQUEST_ACTIONS.ADD
      })

      const doc = await db
        .collection(EMP_QUEUE)
        .findOne({ applicationReferenceNumber: 'APP-001' })
      expect(doc).toMatchObject({
        action: EMP_REQUEST_ACTIONS.ADD,
        applicationReferenceNumber: 'APP-001',
        status: REQUEST_QUEUE_STATUS.PENDING,
        retries: 0,
        createdBy: 'user-123',
        updatedBy: 'user-123'
      })
    })

    it('should default to the add action when none is given', async () => {
      const db = globalThis.mockMongo
      mockServer.methods = {
        processEmpQueue: vi.fn().mockResolvedValue({})
      }

      await empModule.addToEmpQueue({
        request: makeRequest(mockServer),
        applicationReference: 'APP-002'
      })

      const doc = await db
        .collection(EMP_QUEUE)
        .findOne({ applicationReferenceNumber: 'APP-002' })
      expect(doc.action).toBe(EMP_REQUEST_ACTIONS.ADD)
    })

    it('should trigger async queue processing after insertion', async () => {
      mockServer.methods = {
        processEmpQueue: vi.fn().mockResolvedValue({})
      }
      const request = makeRequest(mockServer)

      await empModule.addToEmpQueue({
        request,
        applicationReference: 'APP-003'
      })

      expect(request.server.methods.processEmpQueue).toHaveBeenCalled()
    })

    it('should log error if processEmpQueue fails but not throw', async () => {
      mockServer.methods = {
        processEmpQueue: vi
          .fn()
          .mockRejectedValue(new Error('Queue processing failed'))
      }
      const request = makeRequest(mockServer)

      await empModule.addToEmpQueue({
        request,
        applicationReference: 'APP-004'
      })

      await vi.waitFor(() => {
        expect(mockServer.logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              message: 'Queue processing failed'
            })
          }),
          'Failed to process EMP queue, but exemption submission succeeded'
        )
      })
    })

    it('should throw error if database insertion fails', async () => {
      mockServer.methods = {
        processEmpQueue: vi.fn().mockResolvedValue({})
      }
      const request = makeRequest(mockServer)
      request.db = {
        collection: () => ({
          insertOne: vi
            .fn()
            .mockRejectedValue(new Error('Database connection failed'))
        })
      }

      await expect(
        empModule.addToEmpQueue({
          request,
          applicationReference: 'APP-005'
        })
      ).rejects.toThrow('Database connection failed')
    })
  })
})
