import { describe, expect, test } from 'vitest'
import { setupTestServer } from '../../../../../tests/test-server.js'
import {
  createCompleteExemption,
  createCompleteMarineLicence
} from '../../../../../tests/test.fixture.js'
import {
  collectionEmpQueue,
  collectionExemptions,
  collectionMarineLicences
} from '../../../common/constants/db-collections.js'
import { ObjectId } from 'mongodb'
import { config } from '../../../../config.js'

describe('POST /test-data/cleanup - integration', async () => {
  const getServer = await setupTestServer()

  test('route is not registered outside CDP dev', async () => {
    expect(config.get('cdpEnvironment')).toBe('local')

    const response = await getServer().inject({
      method: 'POST',
      url: '/test-data/cleanup'
    })

    expect(response.statusCode).toBe(404)
  })

  test('handler deletes all data when invoked on dev', async () => {
    const originalEnv = config.get('cdpEnvironment')
    config.set('cdpEnvironment', 'dev')

    try {
      await globalThis.mockMongo.collection(collectionExemptions).insertMany([
        createCompleteExemption({
          _id: new ObjectId(),
          contactId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          applicationReference: 'EXE/2026/90001'
        }),
        createCompleteExemption({
          _id: new ObjectId(),
          contactId: 'ffffffff-1111-2222-3333-444444444444',
          applicationReference: 'EXE/2026/90002'
        })
      ])
      await globalThis.mockMongo
        .collection(collectionMarineLicences)
        .insertMany([
          createCompleteMarineLicence({
            _id: new ObjectId(),
            contactId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            applicationReference: 'MLA/2026/90001'
          })
        ])
      await globalThis.mockMongo
        .collection(collectionEmpQueue)
        .insertMany([
          { applicationReferenceNumber: 'EXE/2026/90001' },
          { applicationReferenceNumber: 'EXE/2026/90002' }
        ])

      const { cleanupTestData } = await import('../cleanup-test-data.js')
      const result = await cleanupTestData(globalThis.mockMongo)

      expect(result.deleted[collectionExemptions]).toBe(2)
      expect(result.deleted[collectionMarineLicences]).toBe(1)
      expect(result.deleted[collectionEmpQueue]).toBe(2)

      expect(
        await globalThis.mockMongo
          .collection(collectionExemptions)
          .countDocuments()
      ).toBe(0)
      expect(
        await globalThis.mockMongo
          .collection(collectionMarineLicences)
          .countDocuments()
      ).toBe(0)
      expect(
        await globalThis.mockMongo
          .collection(collectionEmpQueue)
          .countDocuments()
      ).toBe(0)
    } finally {
      config.set('cdpEnvironment', originalEnv)
      await globalThis.mockMongo.collection(collectionExemptions).deleteMany({})
      await globalThis.mockMongo
        .collection(collectionMarineLicences)
        .deleteMany({})
      await globalThis.mockMongo.collection(collectionEmpQueue).deleteMany({})
    }
  })

  test('handler rejects cleanup on test', async () => {
    const originalEnv = config.get('cdpEnvironment')
    config.set('cdpEnvironment', 'test')

    try {
      const { cleanupTestData } = await import('../cleanup-test-data.js')
      await expect(cleanupTestData(globalThis.mockMongo)).rejects.toMatchObject(
        {
          isBoom: true,
          output: { statusCode: 404 }
        }
      )
    } finally {
      config.set('cdpEnvironment', originalEnv)
    }
  })
})
