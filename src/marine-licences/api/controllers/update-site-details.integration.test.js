import { setupTestServer } from '../../../../tests/test-server.js'
import { ObjectId } from 'mongodb'

const mockCredentials = {
  contactId: '123e4567-e89b-12d3-a456-426614174000'
}

describe('PATCH /marine-licence/site-details - coordinatesEntry validation', async () => {
  const getServer = await setupTestServer()
  const mockId = new ObjectId().toHexString()

  it('should accept coordinatesEntry single when coordinatesType is coordinates', async () => {
    const response = await getServer().inject({
      method: 'PATCH',
      url: '/marine-licence/site-details',
      payload: {
        id: mockId,
        siteDetails: [
          { coordinatesType: 'coordinates', coordinatesEntry: 'single' }
        ]
      },
      auth: {
        strategy: 'jwt',
        credentials: mockCredentials
      }
    })

    expect(response.statusCode).not.toBe(400)
  })

  it('should accept coordinatesEntry multiple when coordinatesType is coordinates', async () => {
    const response = await getServer().inject({
      method: 'PATCH',
      url: '/marine-licence/site-details',
      payload: {
        id: mockId,
        siteDetails: [
          { coordinatesType: 'coordinates', coordinatesEntry: 'multiple' }
        ]
      },
      auth: {
        strategy: 'jwt',
        credentials: mockCredentials
      }
    })

    expect(response.statusCode).not.toBe(400)
  })

  it('should return 400 when coordinatesEntry is an invalid value', async () => {
    const response = await getServer().inject({
      method: 'PATCH',
      url: '/marine-licence/site-details',
      payload: {
        id: mockId,
        siteDetails: [
          { coordinatesType: 'coordinates', coordinatesEntry: 'invalid' }
        ]
      },
      auth: {
        strategy: 'jwt',
        credentials: mockCredentials
      }
    })

    expect(response.statusCode).toBe(400)
    const payload = JSON.parse(response.payload)
    expect(payload.message).toContain('COORDINATES_ENTRY_REQUIRED')
  })

  it('should return 400 when coordinatesEntry is present but coordinatesType is file', async () => {
    const response = await getServer().inject({
      method: 'PATCH',
      url: '/marine-licence/site-details',
      payload: {
        id: mockId,
        siteDetails: [
          {
            coordinatesType: 'file',
            fileUploadType: 'kml',
            coordinatesEntry: 'single'
          }
        ]
      },
      auth: {
        strategy: 'jwt',
        credentials: mockCredentials
      }
    })

    expect(response.statusCode).toBe(400)
  })
})

describe('PATCH /marine-licence/site-details - payload size limits', async () => {
  const getServer = await setupTestServer()
  const tenMegaBytes = 10 * 1000 * 1000

  const mockCredentials = {
    contactId: '123e4567-e89b-12d3-a456-426614174000'
  }

  it('should reject payload 1 byte over the 10MB threshold', async () => {
    const oversizedString = 'x'.repeat(tenMegaBytes + 1)

    const response = await getServer().inject({
      method: 'PATCH',
      url: '/marine-licence/site-details',
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

    const response = await getServer().inject({
      method: 'PATCH',
      url: '/marine-licence/site-details',
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

    const response = await getServer().inject({
      method: 'PATCH',
      url: '/marine-licence/site-details',
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
