export const setupTestServer = async () => {
  let server

  beforeAll(async () => {
    const { createServer } = await import('../src/server.js')
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server?.stop()
  })

  return () => server
}
