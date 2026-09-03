import { MongoClient } from 'mongodb'
import { inject } from 'vitest'

/**
 * Proves the test harness supports multi-document transactions. These tests
 * fail against a standalone mongod, guarding the replica-set configuration
 * of the in-memory test server.
 */
describe('mongo transaction support', () => {
  const collectionA = 'transaction-proof-a'
  const collectionB = 'transaction-proof-b'
  let client
  let db

  beforeAll(async () => {
    client = await MongoClient.connect(inject('mongoUri'))
    db = client.db(process.env.MONGO_DATABASE)
  })

  beforeEach(async () => {
    await db.collection(collectionA).deleteMany({})
    await db.collection(collectionB).deleteMany({})
  })

  afterAll(async () => {
    await client.close()
  })

  test('commits writes to two collections atomically', async () => {
    const session = client.startSession()
    try {
      await session.withTransaction(async () => {
        await db
          .collection(collectionA)
          .insertOne({ ref: 'commit' }, { session })
        await db
          .collection(collectionB)
          .insertOne({ ref: 'commit' }, { session })
      })
    } finally {
      await session.endSession()
    }

    expect(
      await db.collection(collectionA).countDocuments({ ref: 'commit' })
    ).toBe(1)
    expect(
      await db.collection(collectionB).countDocuments({ ref: 'commit' })
    ).toBe(1)
  })

  test('rolls back writes to both collections when the transaction aborts', async () => {
    const session = client.startSession()
    try {
      await expect(
        session.withTransaction(async () => {
          await db
            .collection(collectionA)
            .insertOne({ ref: 'abort' }, { session })
          await db
            .collection(collectionB)
            .insertOne({ ref: 'abort' }, { session })
          throw new Error('deliberate abort')
        })
      ).rejects.toThrow('deliberate abort')
    } finally {
      await session.endSession()
    }

    expect(
      await db.collection(collectionA).countDocuments({ ref: 'abort' })
    ).toBe(0)
    expect(
      await db.collection(collectionB).countDocuments({ ref: 'abort' })
    ).toBe(0)
  })
})
