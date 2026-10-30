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

  test('route is not registered outside CDP dev and test', async () => {
    expect(config.get('cdpEnvironment')).toBe('local')

    const response = await getServer().inject({
      method: 'POST',
      url: '/test-data/cleanup'
    })

    expect(response.statusCode).toBe(404)
  })

  test('handler deletes scoped data when invoked directly on test', async () => {
    const journeyContactId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const otherContactId = 'ffffffff-1111-2222-3333-444444444444'
    const originalEnv = config.get('cdpEnvironment')
    const originalContactId = config.get('journeyTestContactId')

    config.set('cdpEnvironment', 'test')
    config.set('journeyTestContactId', journeyContactId)

    try {
      await globalThis.mockMongo.collection(collectionExemptions).insertMany([
        createCompleteExemption({
          _id: new ObjectId(),
          contactId: journeyContactId,
          applicationReference: 'EXE/2026/90001'
        }),
        createCompleteExemption({
          _id: new ObjectId(),
          contactId: otherContactId,
          applicationReference: 'EXE/2026/90002'
        })
      ])
      await globalThis.mockMongo
        .collection(collectionMarineLicences)
        .insertMany([
          createCompleteMarineLicence({
            _id: new ObjectId(),
            contactId: journeyContactId,
            applicationReference: 'MLA/2026/90001'
          }),
          createCompleteMarineLicence({
            _id: new ObjectId(),
            contactId: otherContactId,
            applicationReference: 'MLA/2026/90002'
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

      expect(result.deleted[collectionExemptions]).toBe(1)
      expect(result.deleted[collectionMarineLicences]).toBe(1)
      expect(result.deleted[collectionEmpQueue]).toBe(1)

      expect(
        await globalThis.mockMongo
          .collection(collectionExemptions)
          .countDocuments()
      ).toBe(1)
      expect(
        await globalThis.mockMongo
          .collection(collectionMarineLicences)
          .countDocuments()
      ).toBe(1)
      expect(
        await globalThis.mockMongo
          .collection(collectionEmpQueue)
          .countDocuments()
      ).toBe(1)
    } finally {
      config.set('cdpEnvironment', originalEnv)
      config.set('journeyTestContactId', originalContactId)
      await globalThis.mockMongo.collection(collectionExemptions).deleteMany({})
      await globalThis.mockMongo
        .collection(collectionMarineLicences)
        .deleteMany({})
      await globalThis.mockMongo.collection(collectionEmpQueue).deleteMany({})
    }
  })
})
