describe('Health Endpoint', () => {
  let server
  beforeAll(async () => {
    // Dynamic import needed due to config being updated by vitest-mongodb
    const { createServer } = await import('../server.js')
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server?.stop({ timeout: 0 })
  })

  test('GET /health returns success message', async () => {
    const response = await server.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    const payload = JSON.parse(response.payload)
    expect(payload).toEqual({ message: 'success' })
  })
})
