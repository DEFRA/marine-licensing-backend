import { MongoClient } from 'mongodb'
import { inject } from 'vitest'
import { withMongoTransaction } from './mongo-transactions.js'

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

describe('withMongoTransaction', () => {
  const collectionA = 'with-transaction-a'
  const collectionB = 'with-transaction-b'
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

  test('commits all writes, returns the callback result and ends the session', async () => {
    let capturedSession

    const result = await withMongoTransaction(client, async (session) => {
      capturedSession = session
      await db.collection(collectionA).insertOne({ ref: 'helper' }, { session })
      await db.collection(collectionB).insertOne({ ref: 'helper' }, { session })
      return 'done'
    })

    expect(result).toBe('done')
    expect(capturedSession.hasEnded).toBe(true)
    expect(
      await db.collection(collectionA).countDocuments({ ref: 'helper' })
    ).toBe(1)
    expect(
      await db.collection(collectionB).countDocuments({ ref: 'helper' })
    ).toBe(1)
  })

  test('rolls back all writes, rethrows and ends the session when the callback throws', async () => {
    let capturedSession

    await expect(
      withMongoTransaction(client, async (session) => {
        capturedSession = session
        await db
          .collection(collectionA)
          .insertOne({ ref: 'helper-abort' }, { session })
        await db
          .collection(collectionB)
          .insertOne({ ref: 'helper-abort' }, { session })
        throw new Error('helper deliberate abort')
      })
    ).rejects.toThrow('helper deliberate abort')

    expect(capturedSession.hasEnded).toBe(true)
    expect(
      await db.collection(collectionA).countDocuments({ ref: 'helper-abort' })
    ).toBe(0)
    expect(
      await db.collection(collectionB).countDocuments({ ref: 'helper-abort' })
    ).toBe(0)
  })
})
