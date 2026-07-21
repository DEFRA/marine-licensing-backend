import { afterAll, beforeAll } from 'vitest'
import { setup, teardown } from 'vitest-mongodb'

beforeAll(async () => {
  if (globalThis.__MONGO_URI__) {
    process.env.MONGO_URI = globalThis.__MONGO_URI__
    return
  }

  await setup({ serverOptions: {} })
  process.env.MONGO_URI = globalThis.__MONGO_URI__
})

afterAll(async () => {
  await teardown()
})
