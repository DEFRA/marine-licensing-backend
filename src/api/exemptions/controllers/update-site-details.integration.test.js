describe('PATCH /exemption/site-details - payload size limits', () => {
  let server
  const tenMegaBytes = 10 * 1000 * 1000

  const mockCredentials = {
    contactId: '123e4567-e89b-12d3-a456-426614174000'
  }

  beforeAll(async () => {
    const { createServer } = await import('../../../server.js')
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server?.stop({ timeout: 1000 })
  })

  it('should reject payload 1 byte over the 10MB threshold', async () => {
    const oversizedString = 'x'.repeat(tenMegaBytes + 1)

    const response = await server.inject({
      method: 'PATCH',
      url: '/exemption/site-details',
      payload: oversizedString,
      headers: {
        'content-type': 'text/plain'
      },
      auth: {
        strategy: 'jwt',
        credentials: mockCredentials
      }
    })

    expect(response.statusCode).toBe(413)
    const payload = JSON.parse(response.payload)
    expect(payload.message).toContain(
      'Payload content length greater than maximum allowed'
    )
  })

  it('should accept payload exactly at the 10MB threshold', async () => {
    const exactString = 'x'.repeat(tenMegaBytes)

    const response = await server.inject({
      method: 'PATCH',
      url: '/exemption/site-details',
      payload: exactString,
      auth: {
        strategy: 'jwt',
        credentials: mockCredentials
      }
    })

    expect(response.statusCode).not.toBe(413) // will fail validation - only after boundary checking
  })

  it('should accept payload 1 byte below the 10MB threshold', async () => {
    const undersizedString = 'x'.repeat(tenMegaBytes - 1)

    const response = await server.inject({
      method: 'PATCH',
      url: '/exemption/site-details',
      payload: undersizedString,
      auth: {
        strategy: 'jwt',
        credentials: mockCredentials
      }
    })

    // will fail validation - only after boundary checking
    expect(response.statusCode).not.toBe(413)
  })
})
