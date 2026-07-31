import { setup, teardown } from 'vitest-mongodb'

beforeAll(async () => {
  // Setup mongo mock
  await setup({
    binary: {
      // Pinned, not 'latest': the nearest-area query needs $documents and
      // $geoNear inside a $lookup sub-pipeline with let, which require a
      // server of at least 7.0.
      version: '7.0.24'
    },
    serverOptions: {},
    autoStart: false
  })
  process.env.MONGO_URI = globalThis.__MONGO_URI__
})

afterAll(async () => {
  await teardown()
})
