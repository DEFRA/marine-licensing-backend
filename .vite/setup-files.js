import { vi, afterAll, beforeAll } from 'vitest'
import { MongoClient } from 'mongodb'
import createFetchMock from 'vitest-fetch-mock'

const fetchMock = createFetchMock(vi)

let client

beforeAll(async () => {
  fetchMock.enableMocks()
  global.fetch = fetchMock
  global.fetchMock = fetchMock
  global.mockHandler = {
    response: vi.fn().mockReturnThis(),
    code: vi.fn().mockReturnThis()
  }
  client = await MongoClient.connect(global.__MONGO_URI__)
  global.mockMongo = client.db('marine-licensing-backend')
})

afterAll(async () => {
  fetchMock.disableMocks()
  await client.close()
})
