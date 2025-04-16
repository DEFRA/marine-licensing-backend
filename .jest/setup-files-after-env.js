// Set CDP Mongo URI to URI supplied by @shelf/jest-mongodb -https://github.com/shelfio/jest-mongodb?tab=readme-ov-file#3-configure-mongodb-client

import { MongoClient } from 'mongodb'

process.env.MONGO_URI = global.__MONGO_URI__
process.env.LOG_ENABLED = false

global.mockHandler = {
  response: jest.fn().mockReturnThis(),
  code: jest.fn().mockReturnThis()
}

let client

beforeAll(async () => {
  client = await MongoClient.connect(global.__MONGO_URI__)
  global.mockMongo = client.db('marine-licensing-backend')
})

afterAll(async () => {
  await client.close()
})
