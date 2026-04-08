import { expect, vi } from 'vitest'
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

describe('Dynamics Processor (MongoDB integration)', () => {
  let mockServer
  const mockGetDynamicsAccessToken = vi.mocked(getDynamicsAccessToken)

  const queueDocBase = {
    action: 'submit',
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
})
