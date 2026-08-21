import { MongoMemoryServer } from 'mongodb-memory-server'

let mongoServer

/**
 * Runs once per test run, in the main process, before any worker is forked.
 * Workers inherit `process.env`, so `MONGO_URI` is visible to config.js at
 * import time rather than only after a per-file `beforeAll`.
 */
export async function setup({ provide }) {
  mongoServer = await MongoMemoryServer.create()
  const uri = mongoServer.getUri()

  process.env.MONGO_URI = uri
  provide('mongoUri', uri)
}

export async function teardown() {
  await mongoServer?.stop()
}
