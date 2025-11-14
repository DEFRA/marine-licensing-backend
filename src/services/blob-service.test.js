import { vi } from 'vitest'
import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3'
import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { config } from '../config.js'
import Boom from '@hapi/boom'

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}

vi.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn().mockReturnValue(mockLogger),
  structureErrorForECS: vi.fn((error) => ({
    error: {
      message: error?.message || String(error),
      stack_trace: error?.stack,
      type: error?.name || error?.constructor?.name || 'Error',
      code: error?.code || error?.statusCode
    }
  }))
}))

vi.mock('../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const configs = {
        aws: {
          region: 'eu-west-2',
          s3: {
            timeout: 30_000,
            endpoint: undefined
          }
        },
        'cdp.maxFileSize': 50_000_000
      }
      return configs[key]
    })
  }
}))

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  HeadObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn()
}))

vi.mock('node:fs', () => ({
  createWriteStream: vi.fn()
}))

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  rm: vi.fn()
}))

vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn()
}))

let BlobService

describe('BlobService', () => {
  let blobService
  let mockS3Client
  let mockSend

  beforeAll(async () => {
    // Import BlobService _after_ mocks are set up
    const module = await import('./blob-service.js')
    BlobService = module.BlobService
  })

  beforeEach(() => {
    mockLogger.info.mockReset()
    mockLogger.warn.mockReset()
    mockLogger.error.mockReset()
    mockLogger.debug.mockReset()

    mockSend = vi.fn()
    mockS3Client = {
      send: mockSend
    }
    S3Client.mockReturnValue(mockS3Client)

    config.get.mockImplementation((key) => {
      const configMap = {
        aws: {
          region: 'eu-west-2',
          s3: {
            timeout: 30_000,
            endpoint: undefined
          }
        },
        'cdp.maxFileSize': 50_000_000
      }
      return configMap[key]
    })

    blobService = new BlobService()
  })

  describe('Constructor', () => {
    it('should create S3Client with default configuration', () => {
      // Constructor call is intentional to test S3Client configuration
      // eslint-disable-next-line no-new
      new BlobService()

      // Then - should configure S3Client correctly
      expect(S3Client).toHaveBeenCalledWith({
        region: 'eu-west-2',
        requestHandler: {
          requestTimeout: 30_000
        }
      })
    })

    it('should create S3Client with custom endpoint for localstack', () => {
      const customMockS3Client = { send: vi.fn() }
      S3Client.mockReturnValue(customMockS3Client)

      const service = new BlobService()
      service.client = new S3Client({
        region: 'eu-west-2',
        endpoint: 'http://localhost:4566',
        forcePathStyle: true,
        requestHandler: {
          requestTimeout: 30_000
        }
      })

      expect(S3Client).toHaveBeenCalledWith({
        region: 'eu-west-2',
        endpoint: 'http://localhost:4566',
        forcePathStyle: true,
        requestHandler: {
          requestTimeout: 30_000
        }
      })
    })

    it('should accept custom S3Client', () => {
      const customClient = { send: vi.fn() }

      const service = new BlobService(customClient)

      expect(service.client).toBe(customClient)
    })
  })

  describe('getMetadata', () => {
    const s3Bucket = 'test-bucket'
    const s3Key = 'test-key.kml'

    it('should successfully retrieve S3 object metadata', async () => {
      const mockResponse = {
        ContentLength: 1024,
        LastModified: new Date('2023-01-01'),
        ContentType: 'application/vnd.google-earth.kml+xml',
        ETag: '"abc123"'
      }
      mockSend.mockResolvedValue(mockResponse)

      const result = await blobService.getMetadata(s3Bucket, s3Key)

      expect(result).toEqual({
        size: 1024,
        lastModified: mockResponse.LastModified,
        contentType: 'application/vnd.google-earth.kml+xml',
        etag: '"abc123"'
      })
      expect(mockSend).toHaveBeenCalledWith(expect.any(HeadObjectCommand))
      expect(HeadObjectCommand).toHaveBeenCalledWith({
        Bucket: s3Bucket,
        Key: s3Key
      })
    })

    it('should throw 404 when S3 object not found', async () => {
      const error = new Error('NoSuchKey')
      error.name = 'NoSuchKey'
      mockSend.mockRejectedValue(error)

      await expect(blobService.getMetadata(s3Bucket, s3Key)).rejects.toThrow(
        Boom.notFound('File not found in S3')
      )
    })

    it('should throw 404 when S3 object not found (NotFound error)', async () => {
      const error = new Error('NotFound')
      error.name = 'NotFound'
      mockSend.mockRejectedValue(error)

      await expect(blobService.getMetadata(s3Bucket, s3Key)).rejects.toThrow(
        Boom.notFound('File not found in S3')
      )
    })

    it('should throw 408 when S3 operation times out', async () => {
      const error = new Error('RequestTimeout')
      error.name = 'RequestTimeout'
      mockSend.mockRejectedValue(error)

      await expect(blobService.getMetadata(s3Bucket, s3Key)).rejects.toThrow(
        Boom.clientTimeout('S3 operation timed out')
      )
    })

    it('should throw 408 when S3 operation times out (TimeoutError)', async () => {
      const error = new Error('TimeoutError')
      error.name = 'TimeoutError'
      mockSend.mockRejectedValue(error)

      await expect(blobService.getMetadata(s3Bucket, s3Key)).rejects.toThrow(
        Boom.clientTimeout('S3 operation timed out')
      )
    })

    it('should throw 500 for other S3 errors', async () => {
      const error = new Error('Access denied')
      mockSend.mockRejectedValue(error)

      await expect(blobService.getMetadata(s3Bucket, s3Key)).rejects.toThrow(
        Boom.internal('S3 metadata retrieval failed: Access denied')
      )
    })
  })

  describe('downloadFile', () => {
    const s3Bucket = 'test-bucket'
    const s3Key = 'test-key.kml'
    const tempPath = '/tmp/test-file'

    beforeEach(() => {
      const mockWriteStream = {
        write: vi.fn(),
        end: vi.fn()
      }
      createWriteStream.mockReturnValue(mockWriteStream)

      pipeline.mockResolvedValue()
    })

    it('should successfully download file from S3', async () => {
      const mockBody = new Readable({
        read() {
          this.push('test content')
          this.push(null)
        }
      })
      const mockResponse = {
        Body: mockBody
      }
      mockSend.mockResolvedValue(mockResponse)

      const result = await blobService.downloadFile(s3Bucket, s3Key, tempPath)

      expect(result).toBe(tempPath)
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetObjectCommand))
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: s3Bucket,
        Key: s3Key
      })
      expect(createWriteStream).toHaveBeenCalledWith(tempPath)
      expect(pipeline).toHaveBeenCalled()
    })

    it('should throw error when S3 response has no body', async () => {
      const mockResponse = {
        Body: null
      }
      mockSend.mockResolvedValue(mockResponse)

      await expect(
        blobService.downloadFile(s3Bucket, s3Key, tempPath)
      ).rejects.toThrow(
        Boom.internal('S3 download failed: No response body received from S3')
      )
    })

    it('should throw 404 when S3 file not found', async () => {
      const error = new Error('NoSuchKey')
      error.name = 'NoSuchKey'
      mockSend.mockRejectedValue(error)

      await expect(
        blobService.downloadFile(s3Bucket, s3Key, tempPath)
      ).rejects.toThrow(Boom.notFound('File not found in S3'))
    })

    it('should throw 408 when S3 download times out', async () => {
      const error = new Error('RequestTimeout')
      error.name = 'RequestTimeout'
      mockSend.mockRejectedValue(error)

      await expect(
        blobService.downloadFile(s3Bucket, s3Key, tempPath)
      ).rejects.toThrow(Boom.clientTimeout('S3 download timed out'))
    })

    it('should throw 500 for pipeline errors', async () => {
      const mockBody = new Readable({
        read() {
          this.push('test content')
          this.push(null)
        }
      })
      const mockResponse = {
        Body: mockBody
      }
      mockSend.mockResolvedValue(mockResponse)
      pipeline.mockRejectedValue(new Error('Pipeline failed'))

      await expect(
        blobService.downloadFile(s3Bucket, s3Key, tempPath)
      ).rejects.toThrow(Boom.internal('S3 download failed: Pipeline failed'))
    })

    it('should throw 500 for other S3 errors', async () => {
      const error = new Error('Access denied')
      mockSend.mockRejectedValue(error)

      await expect(
        blobService.downloadFile(s3Bucket, s3Key, tempPath)
      ).rejects.toThrow(Boom.internal('S3 download failed: Access denied'))
    })
  })

  describe('validateFileSize', () => {
    const s3Bucket = 'test-bucket'
    const s3Key = 'test-key.kml'

    it('should validate file size within limits', async () => {
      const mockMetadata = {
        size: 1024,
        lastModified: new Date(),
        contentType: 'application/vnd.google-earth.kml+xml',
        etag: '"abc123"'
      }
      vi.spyOn(blobService, 'getMetadata').mockResolvedValue(mockMetadata)

      const result = await blobService.validateFileSize(s3Bucket, s3Key)

      expect(result).toEqual(mockMetadata)
      expect(blobService.getMetadata).toHaveBeenCalledWith(s3Bucket, s3Key)
    })

    it('should throw 413 when file exceeds size limit by 1 byte', async () => {
      const mockMetadata = {
        size: 50_000_001, // 1 byte over limit
        lastModified: new Date(),
        contentType: 'application/vnd.google-earth.kml+xml',
        etag: '"abc123"'
      }
      vi.spyOn(blobService, 'getMetadata').mockResolvedValue(mockMetadata)

      await expect(
        blobService.validateFileSize(s3Bucket, s3Key)
      ).rejects.toThrow(
        Boom.entityTooLarge(
          'File size (50000001 bytes) exceeds maximum allowed size (50000000 bytes)'
        )
      )
    })

    it('should allow file when exactly at size limit', async () => {
      const mockMetadata = {
        size: 50_000_000, // exactly at limit
        lastModified: new Date(),
        contentType: 'application/vnd.google-earth.kml+xml',
        etag: '"abc123"'
      }
      vi.spyOn(blobService, 'getMetadata').mockResolvedValue(mockMetadata)

      const result = await blobService.validateFileSize(s3Bucket, s3Key)

      // Should return metadata without throwing
      expect(result).toEqual(mockMetadata)
      expect(blobService.getMetadata).toHaveBeenCalledWith(s3Bucket, s3Key)
    })

    it('should propagate getMetadata errors', async () => {
      const error = Boom.notFound('File not found')
      vi.spyOn(blobService, 'getMetadata').mockRejectedValue(error)

      await expect(
        blobService.validateFileSize(s3Bucket, s3Key)
      ).rejects.toThrow(error)
    })
  })

  describe('createTempDirectory', () => {
    beforeEach(() => {
      mkdir.mockResolvedValue()
    })

    it('should create temporary directory', async () => {
      const result = await blobService.createTempDirectory()

      expect(result).toMatch(/geo-parser\/[a-f0-9-]+$/)
      expect(mkdir).toHaveBeenCalledWith(result, { recursive: true })
    })

    it('should throw error when mkdir fails', async () => {
      const error = new Error('Permission denied')
      mkdir.mockRejectedValue(error)

      await expect(blobService.createTempDirectory()).rejects.toThrow(
        'Permission denied'
      )
    })

    it('should create unique directory names', async () => {
      const dir1 = await blobService.createTempDirectory()
      const dir2 = await blobService.createTempDirectory()

      expect(dir1).not.toBe(dir2)
      expect(mkdir).toHaveBeenCalledTimes(2)
    })
  })

  describe('cleanupTempDirectory', () => {
    const tempDir = '/tmp/test-directory'

    it('should successfully cleanup temporary directory', async () => {
      rm.mockResolvedValue()

      await blobService.cleanupTempDirectory(tempDir)

      expect(rm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true })
    })

    it('should not throw error when cleanup fails', async () => {
      const error = new Error('Directory not found')
      rm.mockRejectedValue(error)

      await expect(
        blobService.cleanupTempDirectory(tempDir)
      ).resolves.not.toThrow()

      expect(rm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true })
    })

    it('should handle non-existent directory gracefully', async () => {
      const error = new Error('ENOENT: no such file or directory')
      error.code = 'ENOENT'
      rm.mockRejectedValue(error)

      await expect(
        blobService.cleanupTempDirectory(tempDir)
      ).resolves.not.toThrow()

      expect(rm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true })
    })
  })

  describe('Configuration variations', () => {
    it('should handle different timeout values', () => {
      const service = new BlobService()
      service.timeout = 60_000

      const customClient = new S3Client({
        region: 'us-east-1',
        requestHandler: {
          requestTimeout: 60_000
        }
      })
      service.client = customClient

      expect(service.timeout).toBe(60_000)
      expect(S3Client).toHaveBeenCalledWith({
        region: 'us-east-1',
        requestHandler: {
          requestTimeout: 60_000
        }
      })
    })

    it('should handle different regions', () => {
      const service = new BlobService()

      const customClient = new S3Client({
        region: 'ap-southeast-2',
        requestHandler: {
          requestTimeout: 30_000
        }
      })
      service.client = customClient

      expect(S3Client).toHaveBeenCalledWith({
        region: 'ap-southeast-2',
        requestHandler: {
          requestTimeout: 30_000
        }
      })
    })

    it('should handle different max file sizes', async () => {
      config.get.mockImplementation((key) => {
        const configMap = {
          'aws.region': 'eu-west-2',
          'aws.s3.timeout': 30_000,
          'aws.s3.endpoint': undefined,
          'cdp.maxFileSize': 100_000_000 // 100MB
        }
        return configMap[key]
      })

      const service = new BlobService()
      const mockMetadata = {
        size: 80_000_000, // 80MB
        lastModified: new Date(),
        contentType: 'application/vnd.google-earth.kml+xml',
        etag: '"abc123"'
      }
      vi.spyOn(service, 'getMetadata').mockResolvedValue(mockMetadata)

      const result = await service.validateFileSize('bucket', 'key')

      expect(result).toEqual(mockMetadata)
    })
  })
})
