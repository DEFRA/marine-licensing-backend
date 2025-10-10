import { vi, afterAll, beforeAll } from 'vitest'
import { MongoClient } from 'mongodb'
import createFetchMock from 'vitest-fetch-mock'

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

afterAll(async () => {
  fetchMock.disableMocks()
  await client.close()
})
