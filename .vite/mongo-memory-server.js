import { MongoMemoryReplSet } from 'mongodb-memory-server'

let mongoServer

/**
 * Runs once per test run, in the main process, before any worker is forked.
 * Workers inherit `process.env`, so `MONGO_URI` is visible to config.js at
 * import time rather than only after a per-file `beforeAll`.
 *
 * A single-member replica set (not a standalone server) so that
 * multi-document transactions work in tests, matching local Docker and all
 * deployed environments. The binary version is pinned to the mongo image
 * version in compose.yml.
 */
export async function setup({ provide }) {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    binary: { version: '7.0.24' }
  })
  const uri = mongoServer.getUri()

  process.env.MONGO_URI = uri
  provide('mongoUri', uri)
}

export async function teardown() {
  await mongoServer?.stop()
}
