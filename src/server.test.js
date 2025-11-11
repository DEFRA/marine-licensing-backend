describe('Server payload size limit', () => {
  let server

  beforeAll(async () => {
    // Dynamic import needed due to config being updated by vitest-mongodb
    const { createServer } = await import('./server.js')
    server = await createServer()
    await server.initialize()

    // Add a test route that accepts POST requests without authentication
    // This route is only for testing the payload size limit
    server.route({
      method: 'POST',
      path: '/test-payload-size',
      options: {
        auth: false
      },
      handler: async (request, h) => {
        return h.response({ message: 'success' }).code(200)
      }
    })
  })

  afterAll(async () => {
    await server?.stop({ timeout: 1000 })
  })

  describe('Payload size boundary conditions', () => {
    it('should accept payload of exactly 50,000,000 bytes (raw)', async () => {
      // Create a raw payload of exactly 50MB
      // When sent as raw string, this will be exactly 50,000,000 bytes
      const exactlyFiftyMB = Buffer.alloc(50_000_000, 'a').toString()

      const response = await server.inject({
        method: 'POST',
        url: '/test-payload-size',
        payload: exactlyFiftyMB,
        headers: {
          'content-type': 'application/octet-stream'
        }
      })

      expect(response.statusCode).not.toBe(413)
      expect(response.statusCode).toBe(200)
    })

    it('should reject payload of 50,000,001 bytes (raw)', async () => {
      // Create a raw payload of 50MB + 1 byte
      const fiftyMBPlusOne = Buffer.alloc(50_000_001, 'a').toString()

      const response = await server.inject({
        method: 'POST',
        url: '/test-payload-size',
        payload: fiftyMBPlusOne,
        headers: {
          'content-type': 'application/octet-stream'
        }
      })

      expect(response.statusCode).toBe(413)
    })
  })
})
