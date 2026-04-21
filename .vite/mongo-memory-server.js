import { setup, teardown } from 'vitest-mongodb'

beforeAll(async () => {
  // Setup mongo mock
  await setup({
    binary: {
      version: 'latest'
    },
    serverOptions: {},
    autoStart: false,
    // Multi-document transactions require a replica set (e.g. submit + sequence).
    type: 'replSet'
  })
  process.env.MONGO_URI = globalThis.__MONGO_URI__
})

afterAll(async () => {
  await teardown()
})
