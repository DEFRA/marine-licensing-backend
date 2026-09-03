import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import * as empModule from './emp-processor.js'

import { config } from '../../../../config.js'
import { REQUEST_QUEUE_STATUS } from '../../constants/request-queue.js'
import {
  collectionEmpQueue,
  collectionEmpQueueFailed
} from '../../constants/db-collections.js'

vi.mock('../../../../config.js')
vi.mock('./emp-client.js')

describe('EMP Processor integration', () => {
  let mockServer

  const queueDocBase = {
    action: 'add',
    applicationReferenceNumber: 'EXE/EMP/1',
    createdAt: new Date(),
    createdBy: 'user',
    updatedAt: new Date(),
    updatedBy: 'user'
  }

  beforeEach(async () => {
    config.get.mockReturnValue({ maxRetries: 3 })

    const db = globalThis.mockMongo
    await Promise.all([
      db.collection(collectionEmpQueue).deleteMany({}),
      db.collection(collectionEmpQueueFailed).deleteMany({})
    ])

    mockServer = {
      app: {},
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      },
      db,
      mongoClient: globalThis.mockMongoClient
    }
  })

  describe('handleEmpQueueItemFailure dead letter move', () => {
    it('should move the item to the failure queue and remove it from the source queue', async () => {
      const db = globalThis.mockMongo
      const _id = new ObjectId()
      const item = {
        _id,
        ...queueDocBase,
        status: REQUEST_QUEUE_STATUS.FAILED,
        retries: 2
      }
      await db.collection(collectionEmpQueue).insertOne(item)

      await empModule.handleEmpQueueItemFailure(mockServer, item)

      expect(
        await db.collection(collectionEmpQueue).findOne({ _id })
      ).toBeNull()
      expect(
        await db.collection(collectionEmpQueueFailed).findOne({ _id })
      ).toMatchObject({ retries: 3, status: REQUEST_QUEUE_STATUS.FAILED })
    })

    it('should leave the item in the source queue and not in the failure queue when the delete fails mid-move', async () => {
      const db = globalThis.mockMongo
      const _id = new ObjectId()
      const item = {
        _id,
        ...queueDocBase,
        status: REQUEST_QUEUE_STATUS.FAILED,
        retries: 2
      }
      await db.collection(collectionEmpQueue).insertOne(item)

      // The dead letter move writes two collections; failing the second
      // write must roll back the first, or the item exists in both queues.
      const dbWithFailingDelete = {
        collection: (name) => {
          const real = db.collection(name)
          if (name !== collectionEmpQueue) {
            return real
          }
          return {
            insertOne: (...args) => real.insertOne(...args),
            updateOne: (...args) => real.updateOne(...args),
            findOne: (...args) => real.findOne(...args),
            deleteOne: () =>
              Promise.reject(new Error('simulated delete failure'))
          }
        }
      }

      await expect(
        empModule.handleEmpQueueItemFailure(
          { ...mockServer, db: dbWithFailingDelete },
          item
        )
      ).rejects.toThrow('simulated delete failure')

      expect(
        await db.collection(collectionEmpQueueFailed).findOne({ _id })
      ).toBeNull()
      expect(
        await db.collection(collectionEmpQueue).findOne({ _id })
      ).toMatchObject({ retries: 2 })
    })
  })
})
