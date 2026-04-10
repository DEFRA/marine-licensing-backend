import { expect, vi } from 'vitest'
import { ObjectId } from 'mongodb'
import * as dynamicsModule from './dynamics-processor.js'
import { DYNAMICS_QUEUE_MAX_ITEMS_PER_PROCESS_RUN } from './dynamics-processor.js'

import { config } from '../../../../config.js'
import {
  REQUEST_QUEUE_STATUS,
  DYNAMICS_QUEUE_TYPES,
  DYNAMICS_REQUEST_ACTIONS
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

describe('Dynamics Processor integration', () => {
  let mockServer
  const mockGetDynamicsAccessToken = vi.mocked(getDynamicsAccessToken)

  const queueDocBase = {
    action: DYNAMICS_REQUEST_ACTIONS.SUBMIT,
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

    const db = globalThis.mockMongo
    await Promise.all([
      db.collection(EXEMPTION_QUEUE).deleteMany({}),
      db.collection(EXEMPTION_QUEUE_FAILED).deleteMany({}),
      db.collection(ML_QUEUE).deleteMany({}),
      db.collection(ML_QUEUE_FAILED).deleteMany({})
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

    mockGetDynamicsAccessToken.mockReset()
    mockGetDynamicsAccessToken.mockResolvedValue('test_token')
    vi.mocked(sendToDynamics).mockReset()
    vi.mocked(sendToDynamics).mockResolvedValue({})
  })

  describe('startDynamicsQueuePolling', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should start polling with the specified interval', () => {
      const intervalMs = 5000
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

      dynamicsModule.startDynamicsQueuePolling(mockServer, intervalMs)
      vi.advanceTimersByTime(intervalMs)

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        intervalMs
      )
      expect(mockServer.app.pollTimer).toBeDefined()

      setIntervalSpy.mockRestore()
      dynamicsModule.stopDynamicsQueuePolling(mockServer)
    })
  })

  describe('stopDynamicsQueuePolling', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

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
      const db = globalThis.mockMongo
      const _id = new ObjectId()
      await db.collection(EXEMPTION_QUEUE).insertOne({
        _id,
        ...queueDocBase,
        type: DYNAMICS_QUEUE_TYPES.EXEMPTION,
        applicationReferenceNumber: 'EXE/SUCCESS/1',
        status: REQUEST_QUEUE_STATUS.IN_PROGRESS
      })

      await dynamicsModule.handleDynamicsQueueItemSuccess(mockServer, {
        _id,
        _sourceCollection: EXEMPTION_QUEUE
      })

      const doc = await db.collection(EXEMPTION_QUEUE).findOne({ _id })
      expect(doc.status).toBe(REQUEST_QUEUE_STATUS.SUCCESS)
    })

    it('should update the marine licence queue item status to SUCCESS', async () => {
      const db = globalThis.mockMongo
      const _id = new ObjectId()
      await db.collection(ML_QUEUE).insertOne({
        _id,
        ...queueDocBase,
        type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE,
        applicationReferenceNumber: 'MLA/SUCCESS/1',
        status: REQUEST_QUEUE_STATUS.IN_PROGRESS
      })

      await dynamicsModule.handleDynamicsQueueItemSuccess(mockServer, {
        _id,
        _sourceCollection: ML_QUEUE
      })

      const doc = await db.collection(ML_QUEUE).findOne({ _id })
      expect(doc.status).toBe(REQUEST_QUEUE_STATUS.SUCCESS)
    })
  })

  describe('handleDynamicsQueueItemFailure', () => {
    it('should increment retries on an exemption queue item', async () => {
      const db = globalThis.mockMongo
      const _id = new ObjectId()
      await db.collection(EXEMPTION_QUEUE).insertOne({
        _id,
        ...queueDocBase,
        type: DYNAMICS_QUEUE_TYPES.EXEMPTION,
        applicationReferenceNumber: 'EXE/FAIL/1',
        status: REQUEST_QUEUE_STATUS.FAILED,
        retries: 1
      })

      await dynamicsModule.handleDynamicsQueueItemFailure(mockServer, {
        _id,
        retries: 1,
        _sourceCollection: EXEMPTION_QUEUE
      })

      const doc = await db.collection(EXEMPTION_QUEUE).findOne({ _id })
      expect(doc.status).toBe(REQUEST_QUEUE_STATUS.FAILED)
      expect(doc.retries).toBe(2)
    })

    it('should increment retries on a marine licence queue item', async () => {
      const db = globalThis.mockMongo
      const _id = new ObjectId()
      await db.collection(ML_QUEUE).insertOne({
        _id,
        ...queueDocBase,
        type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE,
        applicationReferenceNumber: 'MLA/FAIL/1',
        status: REQUEST_QUEUE_STATUS.FAILED,
        retries: 1
      })

      await dynamicsModule.handleDynamicsQueueItemFailure(mockServer, {
        _id,
        retries: 1,
        _sourceCollection: ML_QUEUE
      })

      const doc = await db.collection(ML_QUEUE).findOne({ _id })
      expect(doc.status).toBe(REQUEST_QUEUE_STATUS.FAILED)
      expect(doc.retries).toBe(2)
    })

    it('should move exemption item to exemption dead letter queue after max retries', async () => {
      const db = globalThis.mockMongo
      const _id = new ObjectId()
      const base = {
        _id,
        ...queueDocBase,
        type: DYNAMICS_QUEUE_TYPES.EXEMPTION,
        applicationReferenceNumber: 'EXE/DL/1',
        status: REQUEST_QUEUE_STATUS.FAILED
      }
      await db.collection(EXEMPTION_QUEUE).insertOne({ ...base, retries: 2 })

      await dynamicsModule.handleDynamicsQueueItemFailure(mockServer, {
        ...base,
        retries: 2,
        _sourceCollection: EXEMPTION_QUEUE
      })

      const main = await db.collection(EXEMPTION_QUEUE).findOne({ _id })
      expect(main).toBeNull()

      const dead = await db.collection(EXEMPTION_QUEUE_FAILED).findOne({ _id })
      expect(dead).toMatchObject({
        retries: 3,
        status: REQUEST_QUEUE_STATUS.FAILED
      })
      expect(dead).not.toHaveProperty('_sourceCollection')
    })

    it('should move marine licence item to marine licence dead letter queue after max retries', async () => {
      const db = globalThis.mockMongo
      const _id = new ObjectId()
      const base = {
        _id,
        ...queueDocBase,
        type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE,
        applicationReferenceNumber: 'MLA/DL/1',
        status: REQUEST_QUEUE_STATUS.FAILED
      }
      await db.collection(ML_QUEUE).insertOne({ ...base, retries: 2 })

      await dynamicsModule.handleDynamicsQueueItemFailure(mockServer, {
        ...base,
        retries: 2,
        _sourceCollection: ML_QUEUE
      })

      const main = await db.collection(ML_QUEUE).findOne({ _id })
      expect(main).toBeNull()

      const dead = await db.collection(ML_QUEUE_FAILED).findOne({ _id })
      expect(dead).toMatchObject({
        retries: 3,
        status: REQUEST_QUEUE_STATUS.FAILED
      })
      expect(dead).not.toHaveProperty('_sourceCollection')
    })
  })

  describe('processDynamicsQueue', () => {
    it('should claim from both collections and process combined results', async () => {
      const db = globalThis.mockMongo
      await db.collection(EXEMPTION_QUEUE).insertOne({
        ...queueDocBase,
        type: DYNAMICS_QUEUE_TYPES.EXEMPTION,
        applicationReferenceNumber: 'EXE/2025/00001',
        status: REQUEST_QUEUE_STATUS.PENDING
      })
      await db.collection(ML_QUEUE).insertOne({
        ...queueDocBase,
        type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE,
        applicationReferenceNumber: 'MLA/2025/00001',
        status: REQUEST_QUEUE_STATUS.PENDING
      })

      await dynamicsModule.processDynamicsQueue(mockServer)

      const ex = await db.collection(EXEMPTION_QUEUE).findOne({
        applicationReferenceNumber: 'EXE/2025/00001'
      })
      const ml = await db.collection(ML_QUEUE).findOne({
        applicationReferenceNumber: 'MLA/2025/00001'
      })
      expect(ex.status).toBe(REQUEST_QUEUE_STATUS.SUCCESS)
      expect(ml.status).toBe(REQUEST_QUEUE_STATUS.SUCCESS)
      expect(vi.mocked(sendToDynamics)).toHaveBeenCalledTimes(2)
    })

    it('should tag items with _sourceCollection when processing', async () => {
      const db = globalThis.mockMongo
      await db.collection(EXEMPTION_QUEUE).insertOne({
        ...queueDocBase,
        type: DYNAMICS_QUEUE_TYPES.EXEMPTION,
        applicationReferenceNumber: 'EXE/2025/00002',
        status: REQUEST_QUEUE_STATUS.PENDING
      })

      await dynamicsModule.processDynamicsQueue(mockServer)

      const [, , itemPassedToSend] = vi.mocked(sendToDynamics).mock.calls[0]
      expect(itemPassedToSend._sourceCollection).toBe(EXEMPTION_QUEUE)
    })

    it('should call handleQueueItemFailure when sendToDynamics fails', async () => {
      const db = globalThis.mockMongo
      await db.collection(EXEMPTION_QUEUE).insertOne({
        ...queueDocBase,
        type: DYNAMICS_QUEUE_TYPES.EXEMPTION,
        applicationReferenceNumber: 'EXE/2025/00003',
        status: REQUEST_QUEUE_STATUS.PENDING,
        retries: 1
      })

      vi.mocked(sendToDynamics).mockRejectedValueOnce(
        new Error('Processing failed')
      )

      await dynamicsModule.processDynamicsQueue(mockServer)

      const doc = await db.collection(EXEMPTION_QUEUE).findOne({
        applicationReferenceNumber: 'EXE/2025/00003'
      })
      expect(doc.status).toBe(REQUEST_QUEUE_STATUS.FAILED)
      expect(doc.retries).toBe(2)
    })

    it('should get access token when there are items to process', async () => {
      const db = globalThis.mockMongo
      await db.collection(EXEMPTION_QUEUE).insertOne({
        ...queueDocBase,
        type: DYNAMICS_QUEUE_TYPES.EXEMPTION,
        applicationReferenceNumber: 'EXE/2025/00004',
        status: REQUEST_QUEUE_STATUS.PENDING
      })

      await dynamicsModule.processDynamicsQueue(mockServer)

      expect(mockGetDynamicsAccessToken).toHaveBeenCalled()
    })

    it('should not get access token when both queues are empty', async () => {
      await dynamicsModule.processDynamicsQueue(mockServer)

      expect(mockGetDynamicsAccessToken).not.toHaveBeenCalled()
      expect(vi.mocked(sendToDynamics)).not.toHaveBeenCalled()
    })

    it('should claim FAILED items after retryDelayMs and mark success', async () => {
      const db = globalThis.mockMongo
      const oldUpdatedAt = new Date(Date.now() - 120_000)
      await db.collection(EXEMPTION_QUEUE).insertOne({
        ...queueDocBase,
        type: DYNAMICS_QUEUE_TYPES.EXEMPTION,
        applicationReferenceNumber: 'EXE/2025/00005',
        status: REQUEST_QUEUE_STATUS.FAILED,
        retries: 0,
        updatedAt: oldUpdatedAt
      })

      await dynamicsModule.processDynamicsQueue(mockServer)

      const doc = await db.collection(EXEMPTION_QUEUE).findOne({
        applicationReferenceNumber: 'EXE/2025/00005'
      })
      expect(doc.status).toBe(REQUEST_QUEUE_STATUS.SUCCESS)
    })

    it('should reclaim stale in_progress items after claimStaleMs', async () => {
      const db = globalThis.mockMongo
      const staleAt = new Date(Date.now() - 2 * 60 * 60 * 1000)
      await db.collection(EXEMPTION_QUEUE).insertOne({
        ...queueDocBase,
        type: DYNAMICS_QUEUE_TYPES.EXEMPTION,
        applicationReferenceNumber: 'EXE/2025/00006',
        status: REQUEST_QUEUE_STATUS.IN_PROGRESS,
        updatedAt: staleAt
      })

      await dynamicsModule.processDynamicsQueue(mockServer)

      const doc = await db.collection(EXEMPTION_QUEUE).findOne({
        applicationReferenceNumber: 'EXE/2025/00006'
      })
      expect(doc.status).toBe(REQUEST_QUEUE_STATUS.SUCCESS)
    })

    it('should log errors and skip processing if claim fails on both collections', async () => {
      const db = globalThis.mockMongo
      const rejectClaim = () => Promise.reject(new Error('Database error'))

      mockServer.db = {
        collection: (name) => {
          if (name === EXEMPTION_QUEUE || name === ML_QUEUE) {
            const col = db.collection(name)
            return new Proxy(col, {
              get(target, prop) {
                if (prop === 'findOneAndUpdate') {
                  return rejectClaim
                }
                return Reflect.get(target, prop)
              }
            })
          }
          return db.collection(name)
        }
      }

      await dynamicsModule.processDynamicsQueue(mockServer)

      expect(mockServer.logger.error).toHaveBeenCalledTimes(2)
      expect(vi.mocked(sendToDynamics)).not.toHaveBeenCalled()
    })

    it('should still process the successful collection if one claim fails', async () => {
      const db = globalThis.mockMongo
      await db.collection(EXEMPTION_QUEUE).insertOne({
        ...queueDocBase,
        type: DYNAMICS_QUEUE_TYPES.EXEMPTION,
        applicationReferenceNumber: 'EXE/2025/00999',
        status: REQUEST_QUEUE_STATUS.PENDING
      })

      const mlCol = db.collection(ML_QUEUE)
      mockServer.db = {
        collection: (name) => {
          if (name === ML_QUEUE) {
            return new Proxy(mlCol, {
              get(target, prop) {
                if (prop === 'findOneAndUpdate') {
                  return () =>
                    Promise.reject(new Error('ML collection unavailable'))
                }
                return Reflect.get(target, prop)
              }
            })
          }
          return db.collection(name)
        }
      }

      await dynamicsModule.processDynamicsQueue(mockServer)

      expect(mockServer.logger.error).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to claim dynamics queue item from ${ML_QUEUE}`
      )

      const doc = await db.collection(EXEMPTION_QUEUE).findOne({
        applicationReferenceNumber: 'EXE/2025/00999'
      })
      expect(doc.status).toBe(REQUEST_QUEUE_STATUS.SUCCESS)
    })

    it('should process at most DYNAMICS_QUEUE_MAX_ITEMS_PER_PROCESS_RUN items per run', async () => {
      const db = globalThis.mockMongo
      const extra = 3
      const total = DYNAMICS_QUEUE_MAX_ITEMS_PER_PROCESS_RUN + extra
      const docs = Array.from({ length: total }, (_, i) => ({
        ...queueDocBase,
        type: DYNAMICS_QUEUE_TYPES.EXEMPTION,
        applicationReferenceNumber: `EXE/CAP/${String(i).padStart(5, '0')}`,
        status: REQUEST_QUEUE_STATUS.PENDING
      }))
      await db.collection(EXEMPTION_QUEUE).insertMany(docs)

      await dynamicsModule.processDynamicsQueue(mockServer)

      expect(vi.mocked(sendToDynamics)).toHaveBeenCalledTimes(
        DYNAMICS_QUEUE_MAX_ITEMS_PER_PROCESS_RUN
      )
      const pending = await db
        .collection(EXEMPTION_QUEUE)
        .countDocuments({ status: REQUEST_QUEUE_STATUS.PENDING })
      expect(pending).toBe(extra)
      const success = await db
        .collection(EXEMPTION_QUEUE)
        .countDocuments({ status: REQUEST_QUEUE_STATUS.SUCCESS })
      expect(success).toBe(DYNAMICS_QUEUE_MAX_ITEMS_PER_PROCESS_RUN)
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
      const db = globalThis.mockMongo
      mockServer.methods = {
        processDynamicsQueue: vi.fn().mockResolvedValue({})
      }

      await dynamicsModule.addToDynamicsQueue({
        request: makeRequest(mockServer),
        applicationReference: 'EXE/2025/00001',
        action: DYNAMICS_REQUEST_ACTIONS.SUBMIT
      })

      const doc = await db.collection(EXEMPTION_QUEUE).findOne({
        applicationReferenceNumber: 'EXE/2025/00001'
      })
      expect(doc).toMatchObject({
        type: DYNAMICS_QUEUE_TYPES.EXEMPTION,
        action: DYNAMICS_REQUEST_ACTIONS.SUBMIT,
        applicationReferenceNumber: 'EXE/2025/00001',
        status: REQUEST_QUEUE_STATUS.PENDING,
        retries: 0
      })
    })

    it('should insert into the marine licence queue when type is marineLicence', async () => {
      const db = globalThis.mockMongo
      mockServer.methods = {
        processDynamicsQueue: vi.fn().mockResolvedValue({})
      }

      await dynamicsModule.addToDynamicsQueue({
        request: makeRequest(mockServer),
        applicationReference: 'MLA/2025/00001',
        action: DYNAMICS_REQUEST_ACTIONS.SUBMIT,
        type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE
      })

      const mlDoc = await db.collection(ML_QUEUE).findOne({
        applicationReferenceNumber: 'MLA/2025/00001'
      })
      expect(mlDoc).toMatchObject({
        type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE,
        action: DYNAMICS_REQUEST_ACTIONS.SUBMIT,
        applicationReferenceNumber: 'MLA/2025/00001',
        status: REQUEST_QUEUE_STATUS.PENDING,
        retries: 0
      })

      const exCount = await db.collection(EXEMPTION_QUEUE).countDocuments({
        applicationReferenceNumber: 'MLA/2025/00001'
      })
      expect(exCount).toBe(0)
    })
  })
})
