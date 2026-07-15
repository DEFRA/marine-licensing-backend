import { setup, teardown } from 'vitest-mongodb'

beforeAll(async () => {
  // Setup mongo mock — pin version to avoid slow/unstable "latest" downloads on CI
  await setup({
    binary: {
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
