import { vi, afterAll, beforeAll, beforeEach } from 'vitest'
import { MongoClient } from 'mongodb'
import createFetchMock from 'vitest-fetch-mock'
import {
  collectionExemptions,
  collectionMarineLicences
} from '../src/shared/common/constants/db-collections'

const fetchMock = createFetchMock(vi)

let client

beforeAll(async () => {
  fetchMock.enableMocks()
  globalThis.fetch = fetchMock
  globalThis.fetchMock = fetchMock
  globalThis.mockHandler = {
    response: vi.fn().mockReturnThis(),
    code: vi.fn().mockReturnThis()
  }
  client = await MongoClient.connect(globalThis.__MONGO_URI__)
  globalThis.mockMongo = client.db('marine-licensing-backend')
})

// Empty exemptions collection before each integration test
beforeEach(async () => {
  const collection = globalThis.mockMongo?.collection(collectionExemptions)
  if (collection?.deleteMany) {
    await collection.deleteMany({})
  }
  const marineLicencesCollection = globalThis.mockMongo?.collection(
    collectionMarineLicences
  )
  if (marineLicencesCollection?.deleteMany) {
    await marineLicencesCollection.deleteMany({})
  }
})

afterAll(async () => {
  fetchMock.disableMocks()
  await client.close()
})
