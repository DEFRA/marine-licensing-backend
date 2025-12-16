import { vi, beforeEach, describe, it, expect } from 'vitest'
import { S3Client } from '@aws-sdk/client-s3'

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(function () {
    return { mockClient: true }
  })
}))

vi.mock('../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const configs = {
        aws: {
          region: 'eu-west-2',
          s3: {
            timeout: 30_000,
            endpoint: 'http://localhost:4566'
          }
        }
      }
      return configs[key]
    })
  },
  isDevelopment: true
}))

describe('s3-client', () => {
  let getS3Client

  beforeEach(async () => {
    vi.resetModules()
    S3Client.mockClear()

    // Re-import the module to reset the singleton instance
    const module = await import('./s3-client.js')
    getS3Client = module.getS3Client
  })

  it('should create S3Client with correct configuration on first call', () => {
    const client = getS3Client()

    expect(S3Client).toHaveBeenCalledTimes(1)
    expect(S3Client).toHaveBeenCalledWith({
      region: 'eu-west-2',
      endpoint: 'http://localhost:4566',
      maxAttempts: 3,
      requestHandler: {
        requestTimeout: 30_000
      },
      forcePathStyle: true
    })
    expect(client).toEqual({ mockClient: true })
  })

  it('should return the same instance on subsequent calls', () => {
    const client1 = getS3Client()
    const client2 = getS3Client()
    const client3 = getS3Client()

    expect(S3Client).toHaveBeenCalledTimes(1)
    expect(client1).toBe(client2)
    expect(client2).toBe(client3)
  })
})
